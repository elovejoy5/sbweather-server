# sbweather-server

`sbweather-server` sets up:

- An S3 bucket where JSON forecasts from NWS can be cached
- A lambda function that can download forecast and post it to S3, along with cloudwatch event to invoke it periodically
- Role and policy to enable the above

## Create, update, and destroy cloud resources

Once you've installed terraform and setup an AWS account you can:

1. Create cloud resources &/or deploy changes

```
terraform apply
```

2. Get rid of all the cloud assets

```
terraform destroy
```

## Dependencies

Dependencies:

- Terraform installed on your local so that you can run terraform commands
- AWS permissions set up on your local, for example by setting values of AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars
