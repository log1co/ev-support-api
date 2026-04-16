terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "ev-support-api-tfstate"
    key            = "terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "ev-support-api-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ── Variables ──────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "ev-support-api"
}

# ── Public ECR Repository ──────────────────────────────────────────
resource "aws_ecrpublic_repository" "app" {
  provider        = aws.us_east_1
  repository_name = var.project_name

  catalog_data {
    description = "EV Support API - DevOps portfolio project"
  }

  tags = {
    Project     = var.project_name
    Environment = "demo"
    ManagedBy   = "terraform"
  }
}

# ── IAM: GitHub Actions can push to ECR ───────────────────────────
resource "aws_iam_user" "github_actions" {
  name = "${var.project_name}-github-actions"

  tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }
}

resource "aws_iam_user_policy" "ecr_push" {
  name = "${var.project_name}-ecr-push"
  user = aws_iam_user.github_actions.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr-public:GetAuthorizationToken",
          "sts:GetServiceBearerToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr-public:BatchCheckLayerAvailability",
          "ecr-public:GetRepositoryPolicy",
          "ecr-public:DescribeRepositories",
          "ecr-public:DescribeImageTags",
          "ecr-public:DescribeImages",
          "ecr-public:InitiateLayerUpload",
          "ecr-public:UploadLayerPart",
          "ecr-public:CompleteLayerUpload",
          "ecr-public:PutImage",
          "ecr-public:BatchGetImage",
          "ecr-public:GetDownloadUrlForLayer"
        ]
        Resource = aws_ecrpublic_repository.app.arn
      }
    ]
  })
}

resource "aws_iam_access_key" "github_actions" {
  user = aws_iam_user.github_actions.name
}

# ── Outputs ────────────────────────────────────────────────────────
output "ecr_public_repository_uri" {
  description = "Public ECR repository URI"
  value       = aws_ecrpublic_repository.app.repository_uri
}

output "github_actions_access_key_id" {
  description = "Access key ID for GitHub Actions (add as GitHub secret)"
  value       = aws_iam_access_key.github_actions.id
}

output "github_actions_secret_access_key" {
  description = "Secret access key for GitHub Actions (add as GitHub secret)"
  value       = aws_iam_access_key.github_actions.secret
  sensitive   = true
}

# ── Remote State: S3 Bucket ────────────────────────────────────────
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-tfstate"

  tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Remote State: DynamoDB Lock Table ─────────────────────────────
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "${var.project_name}-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
  }
}