#!/bin/bash

# db-migration-script.sh
# This script handles database migrations using Flyway via SSM Session Manager

set -e

# Check if environment is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <environment>"
    exit 1
fi

# Check if region is provided
if [ -z "$2" ]; then
    echo "Usage: $1 <region>"
    exit 1
fi

if [ -z "$3" ]; then
    echo "Usage: $1 $2 <db_prefix>"
    echo "For akwabet service database use: akwabet-service"
    exit 1
fi

ENVIRONMENT=$(echo "$1" | tr '[:upper:]' '[:lower:]')
REGION=$(echo "$2" | tr '[:upper:]' '[:lower:]')
DBPREFIX=$(echo "$3" | tr '[:upper:]' '[:lower:]')

# Function to get SSM parameter
get_ssm_parameter() {
    aws ssm get-parameter --name "$1" --query Parameter.Value --output text --region ${REGION}
}

# Function to get AWS secret
get_secret() {
    aws secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text --region ${REGION}
}

# Get EC2 instance ID
echo "Retrieving EC2 instance ID..."
EC2_INSTANCE_ID=$(get_ssm_parameter "/akwabet/${ENVIRONMENT}/port-forwarding-instanceid")

echo "Retrieving RDS Secret Name..."
RDS_SECRET_NAME=$(get_ssm_parameter "/akwabet/${ENVIRONMENT}/${DBPREFIX}/rds-secret-name")

echo "Retrieving RDS DB name..."
RDS_DB_NAME=$(get_ssm_parameter "/akwabet/${ENVIRONMENT}/${DBPREFIX}/rds-db-name")

# Get database credentials
echo "Retrieving database credentials..."
DB_SECRET=$(get_secret "${RDS_SECRET_NAME}")
DB_USERNAME=$(echo $DB_SECRET | jq -r '.username')
DB_PASSWORD=$(echo $DB_SECRET | jq -r '.password')

# Get RDS Proxy endpoint
echo "Retrieving RDS Proxy endpoint..."
DB_PROXY_ENDPOINT=$(get_ssm_parameter "/akwabet/${ENVIRONMENT}/${DBPREFIX}/rds-proxy-endpoint")

# Create a temporary directory for migration scripts
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Copy migration scripts to the temporary directory
cp -R ./db/migration/${DBPREFIX}/* $TEMP_DIR/
echo "Copied migration scripts to temporary directory"

# Upload migration scripts to S3
S3_BUCKET="akwabet-db-migration-bkt-res-${ENVIRONMENT}"
S3_PREFIX="migrations-${DBPREFIX}-$(date +%Y%m%d%H%M%S)"
aws s3 sync $TEMP_DIR s3://$S3_BUCKET/$S3_PREFIX --region ${REGION}
echo "Uploaded migration scripts to S3: s3://$S3_BUCKET/$S3_PREFIX"

# Construct the SSM command to download scripts and run Flyway
SSM_COMMAND=$(cat << EOF
#!/bin/bash
set -e

# Install or update Flyway
install_or_update_flyway() {
    
    if ! command -v flyway &> /dev/null; then
        export FLYWAY_VERSION="10.18.0"  # Specify the version you want to use
        echo "Flyway not found. Installing Flyway..."
        wget https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/10.18.0/flyway-commandline-10.18.0-linux-x64.tar.gz
        tar -xvzf flyway-commandline-10.18.0-linux-x64.tar.gz
        sudo mv flyway-10.18.0 /opt/flyway
        sudo ln -s /opt/flyway/flyway /usr/local/bin/flyway
        sudo rm -rf flyway-*
    fi
}

# Install or update Flyway
install_or_update_flyway

# Create migrations directory
mkdir -p $TEMP_DIR

# Download migration scripts from S3
aws s3 sync s3://$S3_BUCKET/$S3_PREFIX $TEMP_DIR --region $REGION

# Function to run Flyway command
run_flyway_command() {
    local command="\$1"
    echo "Running Flyway \$command ..."
    flyway -url="jdbc:postgresql://$DB_PROXY_ENDPOINT:5432/$RDS_DB_NAME" \
           -user="$DB_USERNAME" \
           -password="$DB_PASSWORD" \
           -locations="filesystem:$TEMP_DIR" \
           "\$command"
}


# Run Flyway migrations
run_flyway_command "migrate"
# Verify migrations
run_flyway_command "info"
echo "Database migration completed successfully!"

sudo rm -rf "$TEMP_DIR"

EOF
)

# Replace placeholders with actual values
SSM_COMMAND="${SSM_COMMAND//__DB_PROXY_ENDPOINT__/$DB_PROXY_ENDPOINT}"
SSM_COMMAND="${SSM_COMMAND//__DB_USERNAME__/$DB_USERNAME}"
SSM_COMMAND="${SSM_COMMAND//__DB_PASSWORD__/$DB_PASSWORD}"
SSM_COMMAND="${SSM_COMMAND//__RDS_DB_NAME__/$RDS_DB_NAME}"

# Escape the command for JSON
SSM_COMMAND_ESCAPED=$(echo "$SSM_COMMAND" | jq -Rs .)

# Run the command on the EC2 instance using SSM Send-Command
echo "Sending migration command# Run the command on the EC2 instance using SSM Send-Command"
echo "Sending migration command to EC2 instance... for instance-id $EC2_INSTANCE_ID"
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$EC2_INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "{\"commands\":[$SSM_COMMAND_ESCAPED]}" \
    --output text \
    --query "Command.CommandId" \
    --region "${REGION}")

# Wait for the command to complete
echo "Waiting for migration to complete..."
if ! aws ssm wait command-executed --command-id "$COMMAND_ID" --instance-id "$EC2_INSTANCE_ID" --region "${REGION}"; then
    echo "Error: SSM command execution failed or timed out."
    
    
    
    # Get command error output
    COMMAND_ERROR=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$EC2_INSTANCE_ID" \
        --query "StandardErrorContent" \
        --output text \
        --region "${REGION}" 2>/dev/null)
    
    if [ -n "$COMMAND_ERROR" ]; then
        echo "Command error output:"
        echo "$COMMAND_ERROR"
    fi
    
    exit 1
fi

# Get the command output
echo "Migration process finished. Command output:"
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$EC2_INSTANCE_ID" \
    --query "StandardOutputContent" \
    --output text \
    --region "${REGION}"

# Clean up the temporary directory
rm -rf $TEMP_DIR

# Clean up S3 bucket
echo "Cleaning up S3 bucket..."
aws s3 rm s3://"$S3_BUCKET"/"$S3_PREFIX" --recursive --region "$REGION"

echo "Database migration process and cleanup completed."

echo "Starting clean up process"
# Clean up the temporary directory
rm -rf $TEMP_DIR

# List all objects in the bucket with the specific prefix
objects=$(aws s3api list-objects --bucket "$S3_BUCKET" --prefix "$S3_PREFIX" --region "$REGION" --query 'Contents[].{Key: Key}' --output text)
echo "objects found with prefix $S3_PREFIX in the bucket. $objects"
if [ -z "$objects" ]; then
    echo "No objects found with prefix $S3_PREFIX in the bucket. Nothing to delete."
else
    # Delete all objects in the bucket with the specific prefix
    aws s3 rm s3://"$S3_BUCKET"/ --region "$REGION" --recursive

    echo "All objects with prefix $S3_PREFIX in $S3_BUCKET have been deleted."
fi

echo "S3 prefix cleanup completed."
