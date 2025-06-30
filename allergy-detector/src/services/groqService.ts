interface AllergenAnalysis {
  log_id: string;
  likely_allergens: string[];
  allergen_risk_score: { [key: string]: number };
}

interface AllergenRanking {
  allergen: string;
  risk_score: number;
  frequency: number;
  severity_correlation: number;
  risk_category: 'Low' | 'Medium' | 'High' | 'Critical';
  explanation: string;
  recommendation: string;
}

interface AllergenReport {
  rankings: AllergenRanking[];
  total_logs_analyzed: number;
  summary: string;
  next_steps: {
    test_kits: string[];
    medical_advice: string;
  };
}

// Using Groq API
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Rate limiting
let lastCallTime = 0;
const MIN_INTERVAL = 2000; // 2 seconds between calls

export class GroqService {
  private static async callGroqAPI(prompt: string, systemMessage?: string, temperature: number = 0.1, maxTokens: number = 4000): Promise<any> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < MIN_INTERVAL) {
      const delay = MIN_INTERVAL - timeSinceLastCall;
      console.log(`Rate limiting: waiting ${delay}ms before next API call`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastCallTime = Date.now();

    try {
      const messages = [];
      if (systemMessage) {
        messages.push({
          role: 'system',
          content: systemMessage
        });
      }
      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192', // Using Groq model
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error:', response.status, errorText);
        
        // Check if it's a rate limit error
        if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        }
        
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  }

  // Method for analyzing individual ingredients
  static async analyzeIngredient(ingredient: string, allergen: any): Promise<string> {
    const prompt = `Analyze the potential allergenic properties of "${ingredient}" based on the following data:

Frequency: ${allergen.frequency} occurrences
Average Severity: ${allergen.averageSeverity.toFixed(1)}/10
Symptoms: ${allergen.symptoms.join(', ') || 'None'}
Environmental Notes: ${allergen.environmentalNotes.join(', ') || 'None'}

Provide a concise medical analysis covering:
1. Likelihood of this being a true allergen
2. Severity assessment based on the user's data
3. Medical recommendations for management

Keep the response professional and medically focused.`;

    try {
      const response = await this.callGroqAPI(
        prompt,
        'You are a medical allergy specialist. Provide concise, professional medical analysis of potential allergens.',
        0.3,
        200
      );
      return response;
    } catch (error) {
      console.error(`Error analyzing ingredient ${ingredient}:`, error);
      throw error;
    }
  }

  // Method for analyzing risk levels
  static async analyzeRiskLevel(ingredient: string): Promise<number> {
    const prompt = `Analyze the inherent allergenic risk level of "${ingredient}" as a food ingredient. Consider:

1. How commonly this ingredient causes allergic reactions
2. The typical severity of reactions to this ingredient
3. Whether it's a known major allergen (like peanuts, tree nuts, shellfish, etc.)
4. Cross-reactivity potential with other allergens

Based on this analysis, provide a risk level score from 0-100 where:
- 0-20: Very Low Risk (rarely causes allergies)
- 21-40: Low Risk (occasionally causes mild reactions)
- 41-60: Moderate Risk (moderately allergenic)
- 61-80: High Risk (commonly causes reactions)
- 81-100: Very High Risk (major allergen, severe reactions common)

Respond with ONLY the numerical score (0-100), no other text.`;

    try {
      const response = await this.callGroqAPI(
        prompt,
        'You are a medical allergy specialist. Analyze allergen risk levels and respond with only a numerical score from 0-100.',
        0.1,
        10
      );
      
      // Extract numerical value from response
      const riskLevel = parseInt(response.trim().replace(/[^\d]/g, ''), 10);
      
      if (!isNaN(riskLevel) && riskLevel >= 0 && riskLevel <= 100) {
        return riskLevel;
      } else {
        throw new Error('Invalid risk level response');
      }
    } catch (error) {
      console.error(`Error analyzing risk level for ${ingredient}:`, error);
      throw error;
    }
  }

  // Method for generating overall summary
  static async generateOverallSummary(topAllergens: any[], logsLength: number): Promise<string> {
    const prompt = `Based on the following allergy data, provide a concise overall summary (2-3 sentences) of the user's allergy patterns:

Top Allergens:
${topAllergens.map((allergen, idx) => 
  `${idx + 1}. ${allergen.ingredient} (Frequency: ${allergen.frequency}, Avg Severity: ${allergen.averageSeverity.toFixed(1)}/10, Symptoms: ${allergen.symptoms.join(', ') || 'None'})`
).join('\n')}

Total Logs Analyzed: ${logsLength}

Provide a clear, medical-focused summary that highlights the most important patterns and concerns. Focus on the most frequent allergens and their severity levels.`;

    try {
      const response = await this.callGroqAPI(
        prompt,
        'You are a medical allergy specialist. Provide concise, professional summaries focused on the most important allergy patterns.',
        0.3,
        200
      );
      return response;
    } catch (error) {
      console.error('Error generating overall summary:', error);
      throw error;
    }
  }

  // Method for generating test kit suggestions
  static async generateTestKitSuggestions(topAllergens: any[]): Promise<string> {
    const prompt = `Based on the following allergy data, suggest exactly 5 specific allergy test kits that would be most appropriate for this user:

Top Allergens (Most Likely Allergens):
${topAllergens.map((allergen, idx) => 
  `${idx + 1}. ${allergen.ingredient} (Frequency: ${allergen.frequency}, Avg Severity: ${allergen.averageSeverity.toFixed(1)}/10)`
).join('\n')}

Return ONLY the names of exactly 5 specific test kits with brand names. Do not include any explanations, descriptions, or asterisks. Format as a simple numbered list (1-5) with just the test kit names.

Example format:
1. Test Kit Name by Brand
2. Test Kit Name by Brand
3. Test Kit Name by Brand
4. Test Kit Name by Brand
5. Test Kit Name by Brand

Focus on food allergy test kits that specifically test for the most likely allergens listed above. Select test kits that match those allergens as closely as possible. Be specific with test kit names and brands. If possible, prefer kits that cover multiple of the top allergens.`;

    try {
      const response = await this.callGroqAPI(
        prompt,
        'You are a medical allergy specialist. Return ONLY the names of exactly 5 specific test kits with brand names. No explanations, descriptions, or asterisks. Just a numbered list of test kit names. The test kits should be highly based on the most likely allergens provided.',
        0.3,
        300
      );
      return response;
    } catch (error) {
      console.error('Error generating test kit suggestions:', error);
      throw error;
    }
  }

  // Method for clinical symptom analysis
  static async analyzeClinicalSymptoms(symptoms: string[], symptomDesc: string, timeSinceCondition: string): Promise<string> {
    const prompt = `Analyze these symptoms in 5-6 sentences using medical terminology: ${symptoms.join(', ')}. Description: ${symptomDesc}. Time since onset: ${timeSinceCondition}. Focus on the clinical features, possible mechanisms, and differential diagnosis.`;

    try {
      const response = await this.callGroqAPI(
        prompt,
        'You are a board-certified allergist. Provide a thorough, medically accurate analysis of the symptoms using appropriate medical terminology. Focus on describing the clinical presentation, possible pathophysiological mechanisms, and differential diagnosis. Do not provide treatment advice or urgency assessment. Your response should be clear, professional, and about 5-6 sentences long.',
        0.7,
        250
      );
      return response;
    } catch (error) {
      console.error('Error analyzing clinical symptoms:', error);
      throw error;
    }
  }

  // Method for extracting ingredients from text
  static async extractIngredients(ingredientsText: string): Promise<string> {
    const prompt = ingredientsText;

    try {
      const response = await this.callGroqAPI(
        prompt,
        `You are an expert at extracting food ingredients from product labels and barcode databases. Given the following text, extract only the most structured, quantified, or English ingredient list. If any ingredient is in a different language, translate it to English. Output ONLY the ingredient list itself, with NO introductory, explanatory, or summary sentences. The output must be a single, comma-separated list, with NO duplicate or overlapping items. If the text contains both a structured/quantified/English list and a simple or non-English list, only output the structured/quantified/English list, translating to English if needed. If there are no ingredients, return nothing.

Example input:
Sucre, huile de palme, NOISETTES 13%, LAIT écrémé en poudre 8,7%, cacao maigre 7,4%, émulsifiants: lécithines [SOJA]; vanilline. Sans gluten

Example output:
sugar, palm oil, hazelnuts, skimmed milk powder, fat-reduced cocoa, emulsifier: lecithins (soya), vanillin

If the input contains duplicate or overlapping items, only include each unique ingredient once in the output.`,
        0.2,
        150
      );
      return response;
    } catch (error) {
      console.error('Error extracting ingredients:', error);
      throw error;
    }
  }

  static async analyzeLogIngredients(
    logId: string,
    ingredients: string[],
    symptoms: string[],
    severity: number,
    environmentalCause?: string
  ): Promise<AllergenAnalysis> {
    const prompt = `
Analyze the following allergy log entry and identify potential allergens:

Log ID: ${logId}
Ingredients consumed: ${ingredients.join(', ')}
Symptoms experienced: ${symptoms.join(', ')}
Symptom severity (1-10): ${severity}
Environmental factors: ${environmentalCause || 'None'}

Please identify which ingredients are potential allergens and provide a risk score for each (0.0 to 1.0).

Respond with ONLY a valid JSON object in this exact format:
{
  "log_id": "${logId}",
  "likely_allergens": ["ingredient1", "ingredient2"],
  "allergen_risk_score": {
    "ingredient1": 0.8,
    "ingredient2": 0.4
  }
}
`;

    try {
      const response = await this.callGroqAPI(prompt);
      // Extract the first JSON object from the response string
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return analysis;
    } catch (error) {
      console.error('Error analyzing log ingredients:', error);
      // Return a fallback analysis
      return {
        log_id: logId,
        likely_allergens: [],
        allergen_risk_score: {}
      };
    }
  }

  static async generateFinalReport(
    allergenAnalyses: AllergenAnalysis[],
    logs: any[]
  ): Promise<AllergenReport> {
    const prompt = `
Based on the following allergen analyses from multiple allergy logs, create a comprehensive risk assessment and ranking:

Allergen Analyses: ${JSON.stringify(allergenAnalyses, null, 2)}

Total Logs: ${logs.length}

Please provide a final report with:
1. Ranked list of most likely allergens
2. Risk scores and categories
3. Explanations for each allergen
4. Recommendations for next steps

Respond with ONLY a valid JSON object in this exact format:
{
  "rankings": [
    {
      "allergen": "peanut",
      "risk_score": 85,
      "frequency": 5,
      "severity_correlation": 0.8,
      "risk_category": "High",
      "explanation": "Appeared in 5 logs with high severity correlation",
      "recommendation": "Consider allergy testing"
    }
  ],
  "total_logs_analyzed": ${logs.length},
  "summary": "Overall assessment summary",
  "next_steps": {
    "test_kits": ["Everlywell Food Allergy Test", "myLAB Box Food Allergy Test"],
    "medical_advice": "Consult with an allergist for professional testing"
  }
}
`;

    try {
      const response = await this.callGroqAPI(prompt);
      // Extract the first JSON object from the response string
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const report = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return report;
    } catch (error) {
      console.error('Error generating final report:', error);
      // Return a fallback report
      return {
        rankings: [],
        total_logs_analyzed: logs.length,
        summary: 'Analysis could not be completed',
        next_steps: {
          test_kits: [],
          medical_advice: 'Please consult with a healthcare provider'
        }
      };
    }
  }

  // Method for chatbot responses
  static async generateChatbotResponse(
    userMessage: string,
    logs: any[],
    localAllergens: any[],
    overallSummary: string,
    testKitSuggestions: string
  ): Promise<string> {
    const logsSummary = logs.map(log => ({
      time: log.time,
      severity: log.severity,
      symptoms: log.symptoms,
      products: log.products?.map((p: any) => p.name).join(', ') || 'None',
      environmentalCause: log.environmentalCause || 'None'
    }));

    const allergensSummary = localAllergens.map(allergen => ({
      ingredient: allergen.ingredient,
      frequency: allergen.frequency,
      averageSeverity: allergen.averageSeverity,
      symptoms: allergen.symptoms
    }));

    const prompt = `You are an AI allergy assistant with access to the user's allergy data. Respond to their question in a helpful, informative, and conversational manner.

User's Question: "${userMessage}"

User's Allergy Data:
- Total Logs: ${logs.length}
- Overall Summary: ${overallSummary}
- Top Allergens: ${allergensSummary.map(a => `${a.ingredient} (freq: ${a.frequency}, avg severity: ${a.averageSeverity.toFixed(1)})`).join(', ')}
- Recent Logs: ${logsSummary.slice(-3).map(log => `${log.time}: ${log.symptoms.join(', ')} (severity: ${log.severity})`).join('; ')}
- Test Kit Recommendations: ${testKitSuggestions}

Provide a helpful response that:
1. Addresses their specific question
2. References their allergy data when relevant
3. Offers insights based on their patterns
4. Maintains a conversational, supportive tone
5. Keeps responses concise but informative (2-4 sentences)

Remember: You have access to their complete allergy history, so you can provide personalized insights.`;

    try {
      const response = await this.callGroqAPI(
        prompt,
        'You are a helpful AI allergy assistant. Provide informative, personalized responses based on the user\'s allergy data. Be conversational, supportive, and accurate.',
        0.7,
        300
      );
      return response;
    } catch (error) {
      console.error('Error generating chatbot response:', error);
      throw error;
    }
  }
} 