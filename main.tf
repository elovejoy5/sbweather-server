terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "sbweather-s3-bucket" {
  bucket = "sbweather-s3-bucket"
  force_destroy = true

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}

resource "aws_s3_bucket_ownership_controls" "sbweather-s3-bucket" {
  bucket = aws_s3_bucket.sbweather-s3-bucket.id
  rule {
    object_ownership = "ObjectWriter"
  }
}

resource "aws_s3_bucket_acl" "sbweather-s3-bucket" {
  depends_on = [aws_s3_bucket_ownership_controls.sbweather-s3-bucket]
  bucket = aws_s3_bucket.sbweather-s3-bucket.id
  acl    = "private"
}

resource "aws_s3_bucket_public_access_block" "sbweather-s3-bucket" {
  bucket = aws_s3_bucket.sbweather-s3-bucket.id

  block_public_acls       = false  # Allow public ACLs
  block_public_policy     = false  # Allow public bucket policies
  ignore_public_acls      = false  # Don't ignore public ACLs
  restrict_public_buckets = false  # Don't restrict public access
}

resource "aws_s3_bucket_cors_configuration" "sbweather-s3-bucket" {
  depends_on = [
    aws_s3_bucket_ownership_controls.sbweather-s3-bucket,
    aws_s3_bucket_public_access_block.sbweather-s3-bucket
  ]
  bucket = aws_s3_bucket.sbweather-s3-bucket.id

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "bucket-config" {
  bucket = aws_s3_bucket.sbweather-s3-bucket.id

  rule {
    id     = "delete_old_files"
    status = "Enabled"

    expiration {
      days = 60
    }
  }
}

data "archive_file" "sbweather-cache-forecast" {
  type        = "zip"
  source_file = "sbweather-cache-forecast.js"
  output_path = "tmp/sbweather-cache-forecast.zip"
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/sbweather-cache-forecast"
  retention_in_days = 7
}

resource "aws_lambda_function" "sbweather-cache-forecast" {
  filename      = data.archive_file.sbweather-cache-forecast.output_path
  function_name = "sbweather-cache-forecast"
  role          = aws_iam_role.lambda_role.arn
  handler       = "sbweather-cache-forecast.handler"
  source_code_hash = data.archive_file.sbweather-cache-forecast.output_base64sha256
  runtime = "nodejs18.x"

  timeout = 15
  memory_size = 1024
  environment {
    variables = {
      PRODUCTION = false      
    }
  }
}


data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "sbweather-cache-forecast"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy" "lambda" {
  name = "lambda-permissions"
  role = aws_iam_role.lambda_role.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Resource = [
          "${aws_s3_bucket.sbweather-s3-bucket.arn}",
          "${aws_s3_bucket.sbweather-s3-bucket.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_scheduler_schedule" "every_few_hours" {
  name = "every_few_hours"
  description = "Fires every few hours"
  
  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(6 hours)"
  
  target {
    arn = aws_lambda_function.sbweather-cache-forecast.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}

resource "aws_iam_role" "scheduler_role" {
  name = "scheduler-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "scheduler_policy" {
  name = "scheduler-policy"
  role = aws_iam_role.scheduler_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.sbweather-cache-forecast.arn
        ]
      }
    ]
  })
}