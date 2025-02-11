# sbweather-server

`sbweather-server` sets up:

- An S3 bucket where JSON forecasts from NWS can be cached
- A lambda function that can download forecast and post it to S3, along with cloudwatch event to invoke it periodically
- Role and policy to enable the above

## Dependencies

In order to run lambda locally & do terraform deploys:

- Terraform installed on your local so that you can run terraform commands
- AWS permissions set up on your local, for example by setting values of AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars

## Lambda development

Execute lambda locally:

```
node local-run.js
```

Execute lambda via CLI:

```
aws lambda invoke --function-name sbweather-cache-forecast /dev/stdout
```

## Create, update, and destroy cloud resources w/ Terraform

Once you've installed terraform and setup an AWS account you can:

1. Create cloud resources &/or deploy changes

```
terraform apply
```

2. Get rid of all the cloud assets

```
terraform destroy
```
