# #!/bin/bash

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
    echo "For players service database use: players-service"
    exit 1
fi

# Convert to lowercase
ENVIRONMENT=$(echo "$1" | tr '[:upper:]' '[:lower:]')
REGION=$(echo "$2" | tr '[:upper:]' '[:lower:]')
DBPREFIX=$(echo "$3" | tr '[:upper:]' '[:lower:]')

# Display the values being used
echo "Using environment: $ENVIRONMENT"
echo "Using region: $REGION"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if required commands exist
if ! command_exists aws; then
    echo "Error: AWS CLI is not installed. Please install it and try again."
    exit 1
fi

if ! command_exists jq; then
    echo "Error: jq is not installed. Please install it and try again."
    exit 1
fi

# Check if AWS access keys are set up in environment variables
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "Error: AWS access keys are not set up in environment variables."
    echo "Please set them up using the following commands:"
    echo "export AWS_ACCESS_KEY_ID=your_access_key_id"
    echo "export AWS_SECRET_ACCESS_KEY=your_secret_access_key"
    exit 1
fi

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

echo "Retrieving RDS DB Proxy endpoint..."
RDS_PROXY_ENDPOINT=$(get_ssm_parameter "/akwabet/${ENVIRONMENT}/${DBPREFIX}/rds-proxy-endpoint")

echo "AWS access keys are properly set up in environment variables."

# Retrieve and format the secret
echo "Retrieving secret from AWS Secrets Manager..."
SECRET=$(aws secretsmanager get-secret-value \
    --secret-id $RDS_SECRET_NAME \
    --query SecretString \
    --output text \
    --region $REGION)

if [ $? -ne 0 ]; then
    echo "Error: Failed to retrieve secret from AWS Secrets Manager."
    exit 1
fi

echo "Secret retrieved successfully. Formatted secret:"
echo $SECRET | jq '.'

# Start SSM session for port forwarding
echo "Starting SSM session for port forwarding..."
aws ssm start-session \
    --target "$EC2_INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\": [\"$RDS_PROXY_ENDPOINT\"], \"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}" \
    --region $REGION

if [ $? -ne 0 ]; then
    echo "Error: Failed to start SSM session."
    exit 1
fi

echo "SSM session ended."
