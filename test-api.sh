#!/bin/bash

# Test Registration API
echo "=== Testing Registration ==="
curl -X POST http://localhost:3006/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "law1@yopmail.com",
    "password": "Qwerty12@",
    "firstName": "sitansu",
    "lastName": "Sekhar",
    "role": "lawyer",
    "phoneNumber": "08971658827",
    "firmName": "sitansu",
    "zipCode": "",
    "numberOfEmployees": 1
  }'

echo -e "\n\n=== Testing Login ==="
curl -X POST http://localhost:3006/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "law1@yopmail.com",
    "password": "Qwerty12@"
  }'

echo -e "\n" 