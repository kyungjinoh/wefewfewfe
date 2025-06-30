import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, AlertTriangle, FlaskConical, RefreshCw, Send, MessageCircle } from 'lucide-react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import DashboardSidebar from './DashboardSidebar';
import { GroqService } from './services/groqService';
import './Dashboard.css';
import { useAccessControl } from './hooks/useAccessControl';

interface LogProduct {
  name: string;
  exposureType: string;
  commonList: string[];
  barcode?: string;
}

interface AllergyLog {
  time: string;
  severity: number;
  symptoms: string[];
  symptomDesc: string;
  aiAnalysis: string;
  products: LogProduct[];
  environmentalCause: string;
  docId?: string;
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

interface LocalAllergen {
    ingredient: string;
  frequency: number;
  averageSeverity: number;
  symptoms: string[];
  environmentalNotes: string[];
  aiAnalysis?: string;
  aiLoading?: boolean;
  riskLevel?: number;
  riskLoading?: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const Analysis: React.FC = () => {
  const { redirectIfNoAccess } = useAccessControl();
  
  // Check access on component mount
  useEffect(() => {
    redirectIfNoAccess();
  }, [redirectIfNoAccess]);

  // Add CSS for animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const [logs, setLogs] = useState<AllergyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [aiAnalysisResults, setAiAnalysisResults] = useState<Record<string, string>>({});
  const [aiLoadingStates, setAiLoadingStates] = useState<Record<string, boolean>>({});
  const [riskLevels, setRiskLevels] = useState<Record<string, number>>({});
  const [riskLoadingStates, setRiskLoadingStates] = useState<Record<string, boolean>>({});
  const [riskLevelsLoaded, setRiskLevelsLoaded] = useState(false);
  const [revealedMedicalAnalysis, setRevealedMedicalAnalysis] = useState<Set<string>>(new Set());
  const [overallSummary, setOverallSummary] = useState<string>('');
  const [testKitSuggestions, setTestKitSuggestions] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [testKitLoading, setTestKitLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'ingredients' | 'chatbot'>('ingredients');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [safeFoodLogs, setSafeFoodLogs] = useState<any[]>([]);
  const [showMedicalNote, setShowMedicalNote] = useState(false);

  // Get safe food ingredients set
  const safeFoodIngredients = useMemo(() => {
    const safeIngredients = new Set<string>();
    safeFoodLogs.forEach(log => {
      (log.products || []).forEach((product: any) => {
        (product.commonList || []).forEach((ingredient: string) => {
          safeIngredients.add(ingredient.trim().toLowerCase());
        });
      });
    });
    return safeIngredients;
  }, [safeFoodLogs]);

  // Build allergen map from logs
  const localAllergens = useMemo<LocalAllergen[]>(() => {
    const map: Record<string, { count: number; totalSeverity: number; symptoms: Set<string>; env: Set<string> }> = {};
    logs.forEach(log => {
      (log.products || []).forEach(product => {
        (product.commonList || []).forEach(ingredient => {
          const key = ingredient.trim().toLowerCase();
          if (!map[key]) {
            map[key] = { count: 0, totalSeverity: 0, symptoms: new Set(), env: new Set() };
          }
          map[key].count += 1;
          map[key].totalSeverity += log.severity || 0;
          (log.symptoms || []).forEach(s => map[key].symptoms.add(s));
          if (log.environmentalCause) map[key].env.add(log.environmentalCause);
        });
      });
    });
    
    const allergens = Object.entries(map)
      .map(([ingredient, data]) => ({
        ingredient,
        frequency: data.count,
        averageSeverity: data.count ? data.totalSeverity / data.count : 0,
        symptoms: Array.from(data.symptoms),
        environmentalNotes: Array.from(data.env),
        riskLevel: riskLevels[ingredient] || 50, // Default risk level
      }))
      .filter(allergen => !safeFoodIngredients.has(allergen.ingredient.toLowerCase())); // Filter out safe food ingredients
    
    // Sort by frequency (highest frequency first)
    return allergens.sort((a, b) => b.frequency - a.frequency);
  }, [logs, riskLevels, safeFoodIngredients]);

  // Save AI analysis results to Firebase
  const saveAiAnalysisResults = useCallback(async (results: Record<string, string>) => {
    if (!user) return;
    
    try {
      const analysisRef = doc(db, 'ai_analysis_results', user.uid);
      await setDoc(analysisRef, {
        results,
        timestamp: new Date().toISOString(),
        userId: user.uid
      }, { merge: true });
      console.log('Successfully saved AI analysis results to Firebase');
    } catch (error) {
      console.error('Error saving AI analysis results:', error);
    }
  }, [user]);

  // Save risk levels to Firebase
  const saveRiskLevels = useCallback(async (levels: Record<string, number>) => {
    if (!user) return;
    
    try {
      const riskRef = doc(db, 'risk_levels', user.uid);
      await setDoc(riskRef, {
        levels,
        timestamp: new Date().toISOString(),
        userId: user.uid
      }, { merge: true });
      console.log('Successfully saved risk levels to Firebase');
    } catch (error) {
      console.error('Error saving risk levels:', error);
    }
  }, [user]);

  // Save overall summary to Firebase
  const saveOverallSummary = useCallback(async (summary: string) => {
    if (!user) return;
    
    try {
      console.log('Saving overall summary to Firebase:', summary);
      const summaryRef = doc(db, 'overall_summary', user.uid);
      await setDoc(summaryRef, {
        summary,
        timestamp: new Date().toISOString(),
        userId: user.uid
      }, { merge: true });
      console.log('Successfully saved overall summary to Firebase');
    } catch (error) {
      console.error('Error saving overall summary:', error);
    }
  }, [user]);

  // Save test kit suggestions to Firebase
  const saveTestKitSuggestions = useCallback(async (suggestions: string) => {
    if (!user) return;
    
    try {
      console.log('Saving test kit suggestions to Firebase:', suggestions);
      const testKitRef = doc(db, 'test_kit_suggestions', user.uid);
      await setDoc(testKitRef, {
        suggestions,
        timestamp: new Date().toISOString(),
        userId: user.uid
      }, { merge: true });
      console.log('Successfully saved test kit suggestions to Firebase');
    } catch (error) {
      console.error('Error saving test kit suggestions:', error);
    }
  }, [user]);

  // Fetch user logs from Firebase
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'logs'), where('uid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const logsData: AllergyLog[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        logsData.push({
          time: data.time,
          severity: data.severity,
          symptoms: data.symptoms || [],
          symptomDesc: data.symptomDesc || '',
          aiAnalysis: data.aiAnalysis || '',
          products: data.products || [],
          environmentalCause: data.environmentalCause || '',
          docId: doc.id,
        });
      });
      
      setLogs(logsData);
      console.log('Fetched logs for analysis:', logsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch safe food logs from Firebase
  const fetchSafeFoodLogs = useCallback(async () => {
    if (!user) return;
    
    try {
      const q = query(collection(db, 'safe_foods'), where('uid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const safeFoodData: any[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        safeFoodData.push({
          time: data.time,
          products: data.products || [],
          docId: doc.id,
        });
      });
      
      setSafeFoodLogs(safeFoodData);
    } catch (err) {
      console.error('Error fetching safe food logs:', err);
    }
  }, [user]);

  // Load existing analysis from Firebase
  const loadExistingAnalysis = useCallback(async () => {
    if (!user) return;
    
    try {
      const analysisRef = doc(db, 'allergen_analysis', user.uid);
      const analysisDoc = await getDoc(analysisRef);
      
      if (analysisDoc.exists()) {
        const data = analysisDoc.data();
        console.log('Loaded existing analysis from Firebase:', data);
      }
    } catch (error) {
      console.error('Error loading existing analysis:', error);
    }
  }, [user]);

  // Load AI analysis results from Firebase
  const loadAiAnalysisResults = useCallback(async () => {
    if (!user) return;
    
    try {
      const analysisRef = doc(db, 'ai_analysis_results', user.uid);
      const analysisDoc = await getDoc(analysisRef);
      
      if (analysisDoc.exists()) {
        const data = analysisDoc.data();
        console.log('Loaded AI analysis results from Firebase:', data.results);
        setAiAnalysisResults(data.results || {});
      }
    } catch (error) {
      console.error('Error loading AI analysis results:', error);
    }
  }, [user]);

  // Load risk levels from Firebase
  const loadRiskLevels = useCallback(async () => {
    if (!user) return;
    
    try {
      const riskRef = doc(db, 'risk_levels', user.uid);
      const riskDoc = await getDoc(riskRef);
      
      if (riskDoc.exists()) {
        const data = riskDoc.data();
        console.log('Loaded risk levels from Firebase:', data.levels);
        setRiskLevels(data.levels || {});
      }
    } catch (error) {
      console.error('Error loading risk levels:', error);
    } finally {
      setRiskLevelsLoaded(true);
    }
  }, [user]);

  // Load test kit suggestions from Firebase
  const loadTestKitSuggestions = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Loading test kit suggestions from Firebase...');
      const testKitRef = doc(db, 'test_kit_suggestions', user.uid);
      const testKitDoc = await getDoc(testKitRef);
      
      if (testKitDoc.exists()) {
        const data = testKitDoc.data();
        console.log('Loaded test kit suggestions from Firebase:', data.suggestions);
        setTestKitSuggestions(data.suggestions || '');
      } else {
        console.log('No test kit suggestions found in Firebase');
      }
    } catch (error) {
      console.error('Error loading test kit suggestions:', error);
    }
  }, [user]);

  // Load overall summary from Firebase
  const loadOverallSummary = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Loading overall summary from Firebase...');
      const summaryRef = doc(db, 'overall_summary', user.uid);
      const summaryDoc = await getDoc(summaryRef);
      
      if (summaryDoc.exists()) {
        const data = summaryDoc.data();
        console.log('Loaded overall summary from Firebase:', data.summary);
        setOverallSummary(data.summary || '');
      } else {
        console.log('No overall summary found in Firebase');
      }
    } catch (error) {
      console.error('Error loading overall summary:', error);
    }
  }, [user]);

  // Analyze allergens using Groq AI
  const analyzeAllergens = useCallback(async () => {
    if (!user || logs.length === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      // Step 1: Analyze each log individually
      const allergenAnalyses = [];
      
      for (const log of logs) {
        if (log.products && log.products.length > 0) {
          // Extract all ingredients from products
          const allIngredients = log.products.flatMap(product => product.commonList || []);
          console.log('Ingredients sent to Groq:', allIngredients, 'for log:', log);
          
          if (allIngredients.length > 0) {
            const analysis = await GroqService.analyzeLogIngredients(
              log.docId || 'unknown',
              allIngredients,
              log.symptoms,
              log.severity,
              log.environmentalCause
            );
            allergenAnalyses.push(analysis);
          }
        }
      }
      
      // Step 2: Generate final comprehensive report
      const report = await GroqService.generateFinalReport(allergenAnalyses, logs);
      
      // Step 3: Save analysis to Firebase
      try {
        const analysisRef = doc(db, 'allergen_analysis', user.uid);
        await setDoc(analysisRef, {
          report,
          timestamp: new Date().toISOString(),
          userId: user.uid,
          logsAnalyzed: logs.length
        });
      } catch (error) {
        console.error('Error saving analysis to Firebase:', error);
      }
      
    } catch (error) {
      console.error('Error analyzing allergens:', error);
      setError('Failed to analyze allergens. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, logs]);

  // Analyze individual ingredient with AI
  const analyzeIngredient = useCallback(async (ingredient: string, allergen: LocalAllergen) => {
    if (!user || aiLoadingStates[ingredient]) return;
    
    setAiLoadingStates(prev => ({ ...prev, [ingredient]: true }));
    
    try {
      const analysis = await GroqService.analyzeIngredient(ingredient, allergen);
      
      if (analysis.trim()) {
        setAiAnalysisResults(prev => ({ ...prev, [ingredient]: analysis }));
        // Save to Firebase
        const updatedResults = { ...aiAnalysisResults, [ingredient]: analysis };
        saveAiAnalysisResults(updatedResults);
      } else {
        throw new Error('Empty response from API');
      }
      
    } catch (error) {
      console.error(`Error analyzing ingredient ${ingredient}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze ingredient';
      setAiAnalysisResults(prev => ({ ...prev, [ingredient]: `Error: ${errorMessage}` }));
      
      // Save error state to Firebase
      const updatedResults = { ...aiAnalysisResults, [ingredient]: `Error: ${errorMessage}` };
      saveAiAnalysisResults(updatedResults);
    } finally {
      setAiLoadingStates(prev => ({ ...prev, [ingredient]: false }));
    }
  }, [user, aiLoadingStates, aiAnalysisResults, saveAiAnalysisResults]);

  // Analyze risk level for an ingredient
  const analyzeRiskLevel = useCallback(async (ingredient: string, allergen: LocalAllergen) => {
    if (!user || riskLoadingStates[ingredient]) return;
    
    setRiskLoadingStates(prev => ({ ...prev, [ingredient]: true }));
    
    try {
      const riskLevel = await GroqService.analyzeRiskLevel(ingredient);
      
        setRiskLevels(prev => ({ ...prev, [ingredient]: riskLevel }));
        // Save to Firebase
        const updatedLevels = { ...riskLevels, [ingredient]: riskLevel };
        saveRiskLevels(updatedLevels);
      
    } catch (error) {
      console.error(`Error analyzing risk level for ${ingredient}:`, error);
      // Set a default risk level on error
      const defaultRisk = 50;
      setRiskLevels(prev => ({ ...prev, [ingredient]: defaultRisk }));
      
      // Save default to Firebase
      const updatedLevels = { ...riskLevels, [ingredient]: defaultRisk };
      saveRiskLevels(updatedLevels);
    } finally {
      setRiskLoadingStates(prev => ({ ...prev, [ingredient]: false }));
    }
  }, [user, riskLoadingStates, riskLevels, saveRiskLevels]);

  // Generate overall AI summary
  const generateOverallSummary = useCallback(async () => {
    if (localAllergens.length === 0) return;
    
    setSummaryLoading(true);
    try {
      // Add a small delay to ensure data is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const topAllergens = localAllergens.slice(0, 5);
      const summary = await GroqService.generateOverallSummary(topAllergens, logs.length);
      
      if (summary.trim()) {
        console.log('Successfully generated overall summary:', summary);
        setOverallSummary(summary);
        // Save successful results to Firebase
        saveOverallSummary(summary);
          } else {
            throw new Error('Failed to generate summary - empty response');
      }
      
    } catch (error) {
      console.error('Error generating overall summary:', error);
      const errorMessage = error instanceof Error && error.message.includes('rate limit') 
        ? 'API rate limit exceeded. Please try again later.'
        : 'Unable to generate summary at this time.';
      setOverallSummary(errorMessage);
      // Save error state to Firebase
      saveOverallSummary(errorMessage);
    } finally {
      setSummaryLoading(false);
    }
  }, [localAllergens, logs, saveOverallSummary]);

  // Generate test kit suggestions
  const generateTestKitSuggestions = useCallback(async () => {
    if (localAllergens.length === 0) return;
    
    setTestKitLoading(true);
    try {
      const topAllergens = localAllergens.slice(0, 5);
      const suggestions = await GroqService.generateTestKitSuggestions(topAllergens);
      
      if (suggestions.trim()) {
        setTestKitSuggestions(suggestions);
        // Save successful results to Firebase
        saveTestKitSuggestions(suggestions);
      } else {
        throw new Error('Failed to generate test kit suggestions - empty response');
      }
      
    } catch (error) {
      console.error('Error generating test kit suggestions:', error);
      const errorMessage = error instanceof Error && error.message.includes('rate limit') 
        ? 'API rate limit exceeded. Please try again later.'
        : 'Unable to generate test kit recommendations at this time.';
      setTestKitSuggestions(errorMessage);
      // Save error state to Firebase
      saveTestKitSuggestions(errorMessage);
    } finally {
      setTestKitLoading(false);
    }
  }, [localAllergens, saveTestKitSuggestions]);

  // Regenerate overall AI summary
  const regenerateOverallSummary = useCallback(async () => {
    if (localAllergens.length === 0) return;
    
    setSummaryLoading(true);
    setOverallSummary(''); // Clear existing summary
    try {
      const topAllergens = localAllergens.slice(0, 5);
      const summary = await GroqService.generateOverallSummary(topAllergens, logs.length);
      
      if (summary.trim()) {
        console.log('Successfully regenerated overall summary:', summary);
        setOverallSummary(summary);
        // Save successful results to Firebase
        saveOverallSummary(summary);
      } else {
        throw new Error('Failed to generate summary - empty response');
      }
      
    } catch (error) {
      console.error('Error regenerating overall summary:', error);
      const errorMessage = error instanceof Error && error.message.includes('rate limit') 
        ? 'API rate limit exceeded. Please try again later.'
        : 'Unable to generate summary at this time.';
      setOverallSummary(errorMessage);
      // Save error state to Firebase
      saveOverallSummary(errorMessage);
    } finally {
      setSummaryLoading(false);
      }
  }, [localAllergens, logs, saveOverallSummary]);

  // Regenerate test kit suggestions
  const regenerateTestKitSuggestions = useCallback(async () => {
    if (localAllergens.length === 0) return;
    
    setTestKitLoading(true);
    setTestKitSuggestions(''); // Clear existing suggestions
    try {
      const topAllergens = localAllergens.slice(0, 5);
      const suggestions = await GroqService.generateTestKitSuggestions(topAllergens);
      
      if (suggestions.trim()) {
        setTestKitSuggestions(suggestions);
        // Save successful results to Firebase
        saveTestKitSuggestions(suggestions);
          } else {
            throw new Error('Failed to generate test kit suggestions - empty response');
      }
      
    } catch (error) {
      console.error('Error regenerating test kit suggestions:', error);
      const errorMessage = error instanceof Error && error.message.includes('rate limit') 
        ? 'API rate limit exceeded. Please try again later.'
        : 'Unable to generate test kit recommendations at this time.';
      setTestKitSuggestions(errorMessage);
      // Save error state to Firebase
      saveTestKitSuggestions(errorMessage);
    } finally {
      setTestKitLoading(false);
    }
  }, [localAllergens, saveTestKitSuggestions]);

  // Send chat message
  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await GroqService.generateChatbotResponse(
        message,
        logs,
        localAllergens,
        overallSummary,
        testKitSuggestions
      );

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'bot',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating chatbot response:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [logs, localAllergens, overallSummary, testKitSuggestions, isChatLoading]);

  // Initialize chatbot with welcome message
  useEffect(() => {
    if (activeSection === 'chatbot' && chatMessages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        content: `Hello! I'm your AI allergy assistant. I have access to your allergy data including ${logs.length} logs and can help you understand your patterns, answer questions about your allergies, and provide insights. What would you like to know?`,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages([welcomeMessage]);
    }
  }, [activeSection, chatMessages.length, logs.length]);

  // Reset chat history
  const resetChatHistory = useCallback(() => {
    setChatMessages([]);
    setChatInput('');
    // Re-initialize with welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      content: `Hello! I'm your AI allergy assistant. I have access to your allergy data including ${logs.length} logs and can help you understand your patterns, answer questions about your allergies, and provide insights. What would you like to know?`,
      sender: 'bot',
      timestamp: new Date()
    };
    setChatMessages([welcomeMessage]);
  }, [logs.length]);

  // Automatically analyze risk levels for new ingredients only
  useEffect(() => {
    if (localAllergens.length > 0) {
      localAllergens.slice(0, 10).forEach(allergen => {
        if (!riskLevels[allergen.ingredient] && !riskLoadingStates[allergen.ingredient]) {
          analyzeRiskLevel(allergen.ingredient, allergen);
        }
      });
    }
  }, [localAllergens, riskLevels, riskLoadingStates, analyzeRiskLevel]);

  // Automatically analyze risk levels for new ingredients only (after loading)
  useEffect(() => {
    if (localAllergens.length > 0 && riskLevelsLoaded) {
      localAllergens.slice(0, 10).forEach(allergen => {
        if (!riskLevels[allergen.ingredient] && !riskLoadingStates[allergen.ingredient]) {
          analyzeRiskLevel(allergen.ingredient, allergen);
        }
      });
    }
  }, [localAllergens, riskLevels, riskLoadingStates, riskLevelsLoaded, analyzeRiskLevel]);

  // Check if there are new logs that need analysis
  const checkForNewLogsAndAnalyze = useCallback(async () => {
    if (!user || logs.length === 0) return;
    
    try {
      // Check if we have existing analysis
      const analysisRef = doc(db, 'allergen_analysis', user.uid);
      const analysisDoc = await getDoc(analysisRef);
      
      if (analysisDoc.exists()) {
        const data = analysisDoc.data();
        const lastAnalyzedCount = data.logsAnalyzed || 0;
        
        // Only analyze if we have new logs
        if (logs.length > lastAnalyzedCount) {
          console.log(`Found ${logs.length - lastAnalyzedCount} new logs, triggering analysis...`);
          await analyzeAllergens();
        } else {
          console.log('No new logs found, skipping analysis');
        }
      } else {
        // No existing analysis, run it for the first time
        console.log('No existing analysis found, running initial analysis...');
        await analyzeAllergens();
      }
    } catch (error) {
      console.error('Error checking for new logs:', error);
    }
  }, [user, logs, analyzeAllergens]);

  // Run analysis automatically when logs change and are non-empty
  useEffect(() => {
    if (user) {
        fetchLogs();
      fetchSafeFoodLogs();
      loadAiAnalysisResults();
      loadExistingAnalysis();
      loadRiskLevels();
      loadTestKitSuggestions();
      loadOverallSummary();
    }
  }, [user, fetchLogs, fetchSafeFoodLogs, loadAiAnalysisResults, loadExistingAnalysis, loadRiskLevels, loadTestKitSuggestions, loadOverallSummary]);

  // Check for new logs and analyze only when needed
  useEffect(() => {
    if (logs.length > 0) {
      checkForNewLogsAndAnalyze();
    }
  }, [logs, checkForNewLogsAndAnalyze]);

  // Generate overall summary when allergens are available - only if not already loaded
  useEffect(() => {
    if (localAllergens.length > 0 && !overallSummary && !summaryLoading) {
      generateOverallSummary();
    }
  }, [localAllergens, overallSummary, summaryLoading, generateOverallSummary]);

  // Generate test kit suggestions when allergens are available - only if not already loaded
  useEffect(() => {
    if (localAllergens.length > 0 && !testKitSuggestions && !testKitLoading) {
      generateTestKitSuggestions();
    }
  }, [localAllergens, testKitSuggestions, testKitLoading, generateTestKitSuggestions]);

  // Get risk level color based on numerical value
  const getRiskLevelColor = (riskLevel: number) => {
    if (riskLevel >= 80) return '#dc2626'; // Very high - red
    if (riskLevel >= 60) return '#ea580c'; // High - orange
    if (riskLevel >= 40) return '#d97706'; // Moderate - amber
    if (riskLevel >= 20) return '#16a34a'; // Low - green
    return '#64748b'; // Very low - gray
  };

  // Get risk level background color
  const getRiskLevelBackground = (riskLevel: number) => {
    if (riskLevel >= 80) return '#fef2f2'; // Very high - light red
    if (riskLevel >= 60) return '#fff7ed'; // High - light orange
    if (riskLevel >= 40) return '#fffbeb'; // Moderate - light amber
    if (riskLevel >= 20) return '#f0fdf4'; // Low - light green
    return '#f8fafc'; // Very low - light gray
  };

  // Get risk level text
  const getRiskLevelText = (riskLevel: number) => {
    if (riskLevel >= 80) return 'Very High';
    if (riskLevel >= 60) return 'High';
    if (riskLevel >= 40) return 'Moderate';
    if (riskLevel >= 20) return 'Low';
    return 'Very Low';
  };

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '50%',
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
            }}>
              <BarChart3 size={32} color="#fff" />
            </div>
            <h1 style={{ color: '#1e293b', fontWeight: 800, fontSize: 32, marginBottom: 8 }}>
              Allergen Ranking & Risk Prediction
            </h1>
            <p style={{ color: '#64748b', fontSize: 18, textAlign: 'center', maxWidth: 600 }}>
              AI-powered analysis of your allergy patterns to identify and rank the most likely allergens
            </p>
          </div>

          {/* Medical Disclaimer Note */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
            border: '1px solid #f59e0b',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            maxWidth: 800,
            margin: '0 auto 24px auto'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              cursor: 'pointer',
              justifyContent: 'space-between'
            }} onClick={() => setShowMedicalNote(!showMedicalNote)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: '#92400e', 
                  fontSize: 16 
                }}>
                  Note
                </span>
              </div>
              <span style={{ 
                color: '#92400e', 
                fontSize: 20,
                transition: 'transform 0.2s ease',
                transform: showMedicalNote ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
            </div>
            {showMedicalNote && (
              <div style={{ 
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#92400e',
                fontSize: 14,
                lineHeight: 1.5
              }}>
                ⚠️ Remember: All outputs require clinician verification.<br/>
                This tool does not replace medical judgment or diagnostic testing.
              </div>
            )}
          </div>

          {/* Section Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 32,
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setActiveSection('ingredients')}
              style={{
                background: activeSection === 'ingredients' 
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
                  : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                color: activeSection === 'ingredients' ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: activeSection === 'ingredients' 
                  ? '0 4px 12px rgba(139, 92, 246, 0.3)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (activeSection !== 'ingredients') {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== 'ingredients') {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              <BarChart3 size={20} />
              Ingredients Analysis
            </button>
            <button
              onClick={() => setActiveSection('chatbot')}
              style={{
                background: activeSection === 'chatbot' 
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
                  : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                color: activeSection === 'chatbot' ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: activeSection === 'chatbot' 
                  ? '0 4px 12px rgba(139, 92, 246, 0.3)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (activeSection !== 'chatbot') {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== 'chatbot') {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              <FlaskConical size={20} />
              Chatbot
            </button>
          </div>

          {/* Ingredients Section */}
          {activeSection === 'ingredients' && (
            <div>
          {/* Overall AI Summary */}
          {localAllergens.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: 16,
              padding: 24,
              marginBottom: 32,
              border: '1px solid #0ea5e9',
              position: 'relative'
            }}>
              <h3 style={{ 
                color: '#0c4a6e', 
                fontWeight: 700, 
                fontSize: 20, 
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                    gap: 8,
                    justifyContent: 'space-between'
              }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BarChart3 size={24} />
                Overall AI Summary
                    </div>
                    {!summaryLoading && overallSummary && (
                      <button
                        onClick={regenerateOverallSummary}
                        style={{
                          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        <RefreshCw size={16} />
                        Regenerate
                      </button>
                    )}
              </h3>
              
              {summaryLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid #0ea5e9',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 16 }}>Generating summary...</span>
                </div>
              ) : (
                <p style={{ 
                  color: '#0369a1', 
                  fontSize: 16, 
                  lineHeight: 1.6,
                  margin: 0
                }}>
                  {overallSummary}
                </p>
              )}
            </div>
          )}

          {/* Most Likely Allergens (local analysis) */}
          {localAllergens.length > 0 && (
            <>
              <h2 style={{ color: '#1e293b', fontWeight: 700, fontSize: 24, marginBottom: 24 }}>
                Most Likely Allergens
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {localAllergens.slice(0, 10).map((allergen, idx) => (
                  <div key={allergen.ingredient} style={{
                    background: '#f8fafc',
                    borderRadius: 16,
                    padding: 24,
                    border: '2px solid #bae6fd',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    position: 'relative'
                  }}>
                    {/* Risk Level Badge - Upper Right Corner */}
                    {riskLevels[allergen.ingredient] && (
                      <div style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: getRiskLevelBackground(riskLevels[allergen.ingredient]),
                        color: getRiskLevelColor(riskLevels[allergen.ingredient]),
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                            border: `2px solid ${getRiskLevelColor(riskLevels[allergen.ingredient]) + '20'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: getRiskLevelColor(riskLevels[allergen.ingredient])
                        }} />
                        {getRiskLevelText(riskLevels[allergen.ingredient])}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                      <div style={{
                        background: '#38bdf8',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 18
                      }}>{idx + 1}</div>
                      <h3 style={{ color: '#0ea5e9', fontWeight: 700, fontSize: 20, margin: 0 }}>
                        {allergen.ingredient.charAt(0).toUpperCase() + allergen.ingredient.slice(1)}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', gap: 24, fontSize: 15, marginBottom: 8 }}>
                      <span style={{ color: '#0ea5e9', fontWeight: 600 }}>Frequency: {allergen.frequency}</span>
                      <span style={{ color: '#f59e42', fontWeight: 600 }}>Avg Severity: {allergen.averageSeverity.toFixed(1)}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 14, marginBottom: 8 }}>
                      Symptoms: {allergen.symptoms.length > 0 ? allergen.symptoms.join(', ') : 'None'}
                    </div>
                    {allergen.environmentalNotes.length > 0 && (
                      <div style={{ color: '#64748b', fontSize: 14, marginBottom: 8 }}>
                        Environmental: {allergen.environmentalNotes.join(', ')}
                      </div>
                    )}
                    
                    {/* AI Analysis Section */}
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        {!revealedMedicalAnalysis.has(allergen.ingredient) && (
            <button
                            onClick={async () => {
                              // Always call the API when button is pressed
                              await analyzeIngredient(allergen.ingredient, allergen);
                              setRevealedMedicalAnalysis(prev => new Set(prev).add(allergen.ingredient));
                            }}
              style={{
                              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                              color: '#fff',
                border: 'none',
                              borderRadius: 8,
                              padding: '8px 16px',
                              fontSize: 14,
                              fontWeight: 600,
                cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 8
                            }}
                          >
                                <FlaskConical size={16} />
                            Medical Analysis
            </button>
                        )}
                        
                        {!riskLevels[allergen.ingredient] && !riskLoadingStates[allergen.ingredient] && (
            <button
                            onClick={() => analyzeRiskLevel(allergen.ingredient, allergen)}
              style={{
                              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                              color: '#fff',
                border: 'none',
                              borderRadius: 8,
                              padding: '8px 16px',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                                <BarChart3 size={16} />
                            Analyze Risk Level
                          </button>
                        )}
                      </div>
                      
                      {(aiLoadingStates[allergen.ingredient] || riskLoadingStates[allergen.ingredient]) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
                          <div style={{
                            width: 16,
                            height: 16,
                            border: '2px solid #8b5cf6',
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                          <span style={{ fontSize: 14 }}>
                            {aiLoadingStates[allergen.ingredient] ? 'AI analyzing...' : 'Risk analyzing...'}
                          </span>
                        </div>
                      )}
                      
                      {revealedMedicalAnalysis.has(allergen.ingredient) && aiAnalysisResults[allergen.ingredient] && (
                        <div style={{ 
                          background: aiAnalysisResults[allergen.ingredient].includes('Unable to analyze') 
                            ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                            : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: 12,
                          padding: 16,
                          border: aiAnalysisResults[allergen.ingredient].includes('Unable to analyze')
                            ? '1px solid #fecaca'
                            : '1px solid #0ea5e9'
                        }}>
                          <h4 style={{ 
                            color: aiAnalysisResults[allergen.ingredient].includes('Unable to analyze')
                              ? '#dc2626'
                              : '#0c4a6e', 
                            fontWeight: 600, 
                fontSize: 16,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                                <FlaskConical size={20} />
                            Medical Analysis
                          </h4>
                          <p style={{ 
                            color: aiAnalysisResults[allergen.ingredient].includes('Unable to analyze')
                              ? '#991b1b'
                              : '#0369a1', 
                            fontSize: 14, 
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap'
                          }}>
                            {aiAnalysisResults[allergen.ingredient]}
                          </p>
                          {/* Retry button for failed analyses */}
                          {aiAnalysisResults[allergen.ingredient].includes('Unable to analyze') && (
                            <button
                              onClick={async () => {
                                await analyzeIngredient(allergen.ingredient, allergen);
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '8px 16px',
                                fontSize: 14,
                                fontWeight: 600,
                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginTop: 12
                              }}
                            >
                                  <FlaskConical size={16} />
                              Retry Analysis
            </button>
                          )}
          </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 32,
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
                  <AlertTriangle size={24} color="#dc2626" />
              <div>
                <h4 style={{ color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>
                  Analysis Error
                </h4>
                <p style={{ color: '#991b1b', fontSize: 14 }}>
                  {error}
                </p>
              </div>
          </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
              <div style={{
                background: 'linear-gradient(135deg, #e0e7ef 0%, #c7d2fe 100%)',
                borderRadius: '50%',
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                animation: 'pulse 2s infinite'
              }}>
                    <FlaskConical size={40} color="#6366f1" />
              </div>
              <h3 style={{ color: '#64748b', fontWeight: 600, fontSize: 22, marginBottom: 8 }}>
                Loading your allergy data...
              </h3>
            </div>
          )}

          {/* No Logs State */}
          {!loading && logs.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
              <div style={{
                background: 'linear-gradient(135deg, #e0e7ef 0%, #c7d2fe 100%)',
                borderRadius: '50%',
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24
              }}>
                    <AlertTriangle size={40} color="#6366f1" />
              </div>
              <h3 style={{ color: '#64748b', fontWeight: 600, fontSize: 22, marginBottom: 8 }}>
                No allergy logs found
              </h3>
              <p style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 32 }}>
                You need to submit some allergy logs first to analyze your allergen patterns.
              </p>
            </div>
                  )}

          {/* Allergen Rankings */}

          {/* Test Kit Suggestions */}
          {localAllergens.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          borderRadius: 16,
                          padding: 24,
              marginTop: 32,
              border: '1px solid #f59e0b',
              position: 'relative'
            }}>
              <h3 style={{ 
                color: '#92400e', 
                fontWeight: 700, 
                fontSize: 20, 
                marginBottom: 16,
                          display: 'flex',
                alignItems: 'center',
                    gap: 8,
                    justifyContent: 'space-between'
                        }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FlaskConical size={24} />
                Recommended Test Kits
                    </div>
                    {!testKitLoading && testKitSuggestions && (
                      <button
                        onClick={regenerateTestKitSuggestions}
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        <RefreshCw size={16} />
                        Regenerate
                      </button>
                    )}
              </h3>
              
              {testKitLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#92400e' }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid #f59e0b',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 16 }}>Generating test kit recommendations...</span>
                        </div>
              ) : (
                <div>
                  {testKitSuggestions && testKitSuggestions !== 'Unable to generate test kit recommendations at this time.' ? (
                    <div style={{ display: 'grid', gap: 16 }}>
                      {testKitSuggestions.split('\n').filter(line => line.trim() && /^\d+\./.test(line.trim())).map((line, index) => {
                        const match = line.match(/^\d+\.\s*(.+)/);
                        if (match) {
                          const content = match[1];
                          return (
                            <div key={index} style={{
                              background: 'linear-gradient(135deg, #ffffff 0%, #fefce8 100%)',
                              borderRadius: 12,
                              padding: 20,
                              border: '1px solid #fbbf24',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              {/* Number badge */}
                              <div style={{
                                position: 'absolute',
                                top: -8,
                                left: -8,
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: '#fff',
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                fontWeight: 700,
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                              }}>
                                {index + 1}
                    </div>
                              
                              {/* Content */}
                              <div style={{ marginLeft: 20 }}>
                                <p style={{ 
                                  color: '#92400e', 
                                  fontSize: 16, 
                                  lineHeight: 1.6,
                                  fontWeight: 500,
                                  margin: 0
                                }}>
                                  {content}
                                </p>
                </div>
                              
                              {/* Decorative element */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: 60,
                                height: 60,
                                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
                                borderRadius: '0 12px 0 60px'
                              }} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ) : (
                    <div style={{ 
                      color: '#92400e', 
                      fontSize: 16, 
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {testKitSuggestions}
                            </div>
                          )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chatbot Section */}
          {activeSection === 'chatbot' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '600px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}>
              {/* Chat Header */}
              <div style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <MessageCircle size={24} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 18, margin: 0, textAlign: 'left' }}>
                      AI Allergy Assistant
                    </h3>
                    <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 14, margin: 0 }}>
                      Your AI-powered clinical support tool for exposure-symptom analysis. Ask me about your allergens!
                    </p>
                  </div>
                </div>
                
                {/* Reset Button */}
                <button
                  onClick={resetChatHistory}
                  disabled={isChatLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isChatLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                    opacity: isChatLoading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isChatLoading) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChatLoading) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    }
                  }}
                >
                  <RefreshCw size={14} />
                  Reset Chat
                </button>
              </div>

              {/* Chat Messages */}
              <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 8
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: message.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: message.sender === 'user' 
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                      color: message.sender === 'user' ? '#fff' : '#1e293b',
                      fontSize: 14,
                      lineHeight: 1.5,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      border: message.sender === 'bot' ? '1px solid #e2e8f0' : 'none'
                    }}>
                      {message.content}
                    </div>
                  </div>
                ))}
                
                {isChatLoading && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    marginBottom: 8
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '18px 18px 18px 4px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        border: '2px solid #8b5cf6',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <span style={{ color: '#64748b', fontSize: 14 }}>AI is thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div style={{
                padding: '20px',
                borderTop: '1px solid #e2e8f0',
                background: '#fff'
              }}>
                <div style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-end'
                }}>
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage(chatInput);
                        }
                      }}
                      placeholder="Ask me about your allergy patterns, symptoms, or any questions you have..."
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        maxHeight: '120px',
                        padding: '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '22px',
                        fontSize: 14,
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.5
                      }}
                      disabled={isChatLoading}
                    />
                  </div>
                  <button
                    onClick={() => sendChatMessage(chatInput)}
                    disabled={!chatInput.trim() || isChatLoading}
                    style={{
                      background: chatInput.trim() && !isChatLoading
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                        : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                      color: chatInput.trim() && !isChatLoading ? '#fff' : '#9ca3af',
                      border: 'none',
                      borderRadius: '50%',
                      width: 44,
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: chatInput.trim() && !isChatLoading ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
                </div>
              )}
        </div>
      </main>
    </div>
  );
};

export default Analysis;