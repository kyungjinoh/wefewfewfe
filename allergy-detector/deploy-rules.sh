#!/bin/bash

# Deploy Firebase security rules
echo "Deploying Firebase security rules..."
firebase deploy --only firestore:rules
 
echo "Rules deployed successfully!" 