#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AkwabetLambdasStack } from '../lib/akwabet-lambdas-stack';

const app = new cdk.App();

const environment = ((String)(app.node.tryGetContext('environment'))).toLowerCase();

// Create a dynamic stack name
const stackName = `AkwabetLambdasStack-${environment}`;


new AkwabetLambdasStack(app, stackName, {});

cdk.Tags.of(app).add('Environment', environment);