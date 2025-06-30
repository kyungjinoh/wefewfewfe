# Firebase Setup and Rate Limit Handling

## Firebase Security Rules

To fix the "Missing or insufficient permissions" error, you need to deploy the updated security rules to Firebase.

### Deploy Security Rules

1. Make sure you have Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Groq API Rate Limit Handling

The application now includes better error handling for Groq API rate limits:

### Rate Limit Issues
- The free tier of Groq has a daily token limit of 500,000 tokens
- When the limit is reached, you'll see "API rate limit exceeded" messages
- The app will show user-friendly error messages instead of technical errors

### Solutions for Rate Limits

1. **Wait for Reset**: The rate limit resets daily
2. **Upgrade Groq Plan**: Visit https://console.groq.com/settings/billing to upgrade
3. **Use Different API Key**: If you have multiple API keys, you can rotate them

### Error Handling Improvements

The app now:
- Detects 429 (rate limit) errors specifically
- Shows user-friendly messages for rate limits
- Saves error states to Firebase to avoid repeated API calls
- Provides retry mechanisms with simpler prompts

### Firebase Collections

The app uses these Firebase collections:
- `logs` - User allergy logs
- `allergen_analysis` - Comprehensive allergen analysis
- `ai_analysis_results` - Individual ingredient medical analysis
- `risk_levels` - Ingredient risk level scores
- `overall_summary` - AI-generated overall summary
- `test_kit_suggestions` - Recommended test kits

All collections are protected by security rules that ensure users can only access their own data.

## Troubleshooting

### Firebase Permission Errors
If you still see permission errors after deploying rules:
1. Check that you're logged in with the correct Firebase project
2. Verify the security rules were deployed successfully
3. Clear browser cache and try again

### API Rate Limit Errors
If you see rate limit errors:
1. Check your Groq usage at https://console.groq.com/settings/billing
2. Wait for the daily reset or upgrade your plan
3. The app will continue to work with cached data even when rate limited 