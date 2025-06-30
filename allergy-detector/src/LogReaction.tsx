import React, { useState, useRef, useEffect } from 'react';
import DashboardSidebar from './DashboardSidebar';
import { ClipboardCheck, Brain, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, ChevronRight, Stethoscope, Utensils } from 'lucide-react';
import './Dashboard.css';
import { db } from './firebase';
import { addDoc, collection, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { GroqService } from './services/groqService';
import { useAccessControl } from './hooks/useAccessControl';

const symptomOptions = [
  // Skin Reactions
  'Hives (raised, itchy welts)',
  'Red rash (flat or bumpy)',
  'Swelling (lips/face/hands)',
  'Eczema flare (dry, scaly patches)',
  'Burning/stinging sensation',
  // Respiratory Symptoms
  'Sneezing fits',
  'Runny/stuffy nose',
  'Coughing (dry or wet)',
  'Wheezing/whistling breath',
  'Chest tightness',
  // Eye/Nose/Throat
  'Watery, itchy eyes',
  'Swollen eyelids',
  'Scratchy/sore throat',
  'Postnasal drip',
  // Digestive Issues
  'Nausea/vomiting',
  'Stomach cramps',
  'Diarrhea',
  'Mouth itching (tingling lips/tongue)',
  // Severe Warning Signs
  'Trouble breathing/swallowing',
  'Dizziness/fainting',
  'Rapid heartbeat',
  'Slurred speech',
  'Blue lips/fingernails'
];

const symptomCategories = [
  {
    title: 'Skin Reactions',
    symptoms: [
      'Hives (raised, itchy welts)',
      'Red rash (flat or bumpy)',
      'Swelling (lips/face/hands)',
      'Eczema flare (dry, scaly patches)',
      'Burning/stinging sensation'
    ]
  },
  {
    title: 'Respiratory Symptoms',
    symptoms: [
      'Sneezing fits',
      'Runny/stuffy nose',
      'Coughing (dry or wet)',
      'Wheezing/whistling breath',
      'Chest tightness'
    ]
  },
  {
    title: 'Eye/Nose/Throat',
    symptoms: [
      'Watery, itchy eyes',
      'Swollen eyelids',
      'Scratchy/sore throat',
      'Postnasal drip'
    ]
  },
  {
    title: 'Digestive Issues',
    symptoms: [
      'Nausea/vomiting',
      'Stomach cramps',
      'Diarrhea',
      'Mouth itching (tingling lips/tongue)'
    ]
  },
  {
    title: 'Severe Warning Signs (Seek immediate care if checked)',
    symptoms: [
      'Trouble breathing/swallowing',
      'Dizziness/fainting',
      'Rapid heartbeat',
      'Slurred speech',
      'Blue lips/fingernails'
    ],
    isWarning: true
  }
];

const LogReaction: React.FC = () => {
  const { redirectIfNoAccess } = useAccessControl();
  
  // Check access on component mount
  useEffect(() => {
    redirectIfNoAccess();
  }, [redirectIfNoAccess]);

  const [step, setStep] = useState(0);
  const [time, setTime] = useState('');
  const [severity, setSeverity] = useState(3);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDesc, setSymptomDesc] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAllSymptoms, setShowAllSymptoms] = useState(false);
  const [showScaleInterpretation, setShowScaleInterpretation] = useState(false);
  const [showPatientInstructions, setShowPatientInstructions] = useState(false);
  const [showEnvironmentalInstructions, setShowEnvironmentalInstructions] = useState(false);
  const [environmentalCause, setEnvironmentalCause] = useState('');
  const [products, setProducts] = useState([
    {
      exposureType: '',
      foodType: '',
      manualIngredient: '',
      commonList: [] as string[],
      scanText: '',
      isScanning: false,
      scanError: '',
      isListing: false,
      listError: '',
      entryMode: null as 'manual' | 'scan' | 'barcode' | null,
      editIndex: null as number | null,
      editValue: '',
      isEditingOrDeleting: false,
      deletedItemsRef: [] as string[],
      expanded: true,
      name: '',
      barcode: '',
      barcodeError: '',
      isBarcodeLoading: false,
      hasProcessedScanText: false,
    },
  ]);
  const [activeProduct, setActiveProduct] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [safeFoodStep, setSafeFoodStep] = useState(0);
  const [safeFoodTime, setSafeFoodTime] = useState('');
  const [safeFoodProducts, setSafeFoodProducts] = useState([
    {
      exposureType: '',
      foodType: '',
      manualIngredient: '',
      commonList: [] as string[],
      scanText: '',
      isScanning: false,
      scanError: '',
      isListing: false,
      listError: '',
      entryMode: null as 'manual' | 'scan' | 'barcode' | null,
      editIndex: null as number | null,
      editValue: '',
      isEditingOrDeleting: false,
      deletedItemsRef: [] as string[],
      expanded: true,
      name: '',
      barcode: '',
      barcodeError: '',
      isBarcodeLoading: false,
      hasProcessedScanText: false,
    },
  ]);
  const [isSafeFoodSubmitting, setIsSafeFoodSubmitting] = useState(false);

  console.log('LogReaction render, step:', step);

  // Function to clean AI response and remove asterisks
  const cleanAIResponse = (response: string): string[] => {
    return response
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean)
      .map((item: string) => item.replace(/\*\*/g, '').trim()) // Remove double asterisks
      .filter((item: string) => item.length > 0); // Remove empty items after cleaning
  };

  const handleSymptomChange = (option: string) => {
    setSymptoms(prev =>
      prev.includes(option)
        ? prev.filter(s => s !== option)
        : [...prev, option]
    );
  };

  const calculateTimeSinceCondition = () => {
    if (!time) return '';
    const conditionTime = new Date(time);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - conditionTime.getTime()) / (1000 * 60 * 60));
    const diffInMinutes = Math.floor((now.getTime() - conditionTime.getTime()) / (1000 * 60));
    
    if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
  };

  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    console.log('analyzeWithAI: started');
    try {
      const timeSinceCondition = calculateTimeSinceCondition();
      console.log('analyzeWithAI: timeSinceCondition', timeSinceCondition);
      console.log('analyzeWithAI: symptoms', symptoms);
      console.log('analyzeWithAI: symptomDesc', symptomDesc);
      const analysis = await GroqService.analyzeClinicalSymptoms(symptoms, symptomDesc, timeSinceCondition);
      console.log('analyzeWithAI: analysis result', analysis);
      setAiAnalysis(analysis);
      console.log('analyzeWithAI: setAiAnalysis done, moving to step 2');
      setStep(2);
    } catch (error) {
      console.error('AI Analysis error:', error);
      setAiAnalysis('Unable to perform clinical analysis at this time. Please consult with a healthcare professional.');
    } finally {
      setIsAnalyzing(false);
      console.log('analyzeWithAI: finished');
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Step 1 submit triggered');
    console.log('Time:', time);
    console.log('Symptoms:', symptoms);
    console.log('SymptomDesc:', symptomDesc);
    console.log('Form valid:', time && symptoms.length > 0 && symptomDesc.trim());
    
    if (time && symptoms.length > 0 && symptomDesc.trim()) {
      console.log('Proceeding to analyze with AI...');
      analyzeWithAI();
      setStep(2);
    } else {
      console.log('Form validation failed');
    }
  };

  const displayedSymptoms = showAllSymptoms ? symptomOptions : symptomOptions.slice(0, 12);

  const fetchBarcodeIngredients = async (idx: number) => {
    setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: true, barcodeError: '' } : pr));
    const barcode = products[idx].barcode?.trim();
    if (!barcode) {
      setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'Please enter a barcode.' } : pr));
      return;
    }
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 1 && data.product && Array.isArray(data.product.ingredients) && data.product.ingredients.length > 0) {
        // Use the 'ingredients' array, join all 'text' fields
        const ingredientsArr = data.product.ingredients.map((ing: any) => ing.text).filter(Boolean);
        const ingredientsText = ingredientsArr.join(', ');
        // Also get allergens
        const allergensArr = Array.isArray(data.product.allergens_tags) ? data.product.allergens_tags.map((a: string) => a.replace(/^en:/, '').replace(/_/g, ' ').toLowerCase()) : [];
        const groqResponse = await GroqService.extractIngredients(ingredientsText);
        const list = cleanAIResponse(groqResponse);
          // Add allergens (lowercased, no duplicates)
          const allItems = [
            ...list,
            ...allergensArr.filter((a: string) => !list.includes(a))
          ];
          if (allItems.length === 0) {
            setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'No ingredients found for this barcode.' } : pr));
          } else {
            setProducts(p => p.map((pr, i) => i === idx ? {
              ...pr,
              isBarcodeLoading: false,
              barcodeError: '',
              commonList: [
                ...pr.commonList,
                ...allItems.filter((ing: string) => !pr.commonList.map(x => x.toLowerCase().trim()).includes(ing.toLowerCase().trim()))
              ]
            } : pr));
        }
      } else {
        setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'Product not found.' } : pr));
      }
    } catch (err) {
      setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'Error fetching barcode.' } : pr));
    }
  };

  const fetchSafeFoodBarcodeIngredients = async (idx: number) => {
    setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: true, barcodeError: '' } : pr));
    const barcode = safeFoodProducts[idx].barcode?.trim();
    if (!barcode) {
      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'Please enter a barcode.' } : pr));
      return;
    }
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 1 && data.product && Array.isArray(data.product.ingredients) && data.product.ingredients.length > 0) {
        // Use the 'ingredients' array, join all 'text' fields
        const ingredientsArr = data.product.ingredients.map((ing: any) => ing.text).filter(Boolean);
        const ingredientsText = ingredientsArr.join(', ');
        // Also get allergens
        const allergensArr = Array.isArray(data.product.allergens_tags) ? data.product.allergens_tags.map((a: string) => a.replace(/^en:/, '').replace(/_/g, ' ').toLowerCase()) : [];
        const groqResponse = await GroqService.extractIngredients(ingredientsText);
        const list = cleanAIResponse(groqResponse);
          // Add allergens (lowercased, no duplicates)
          const allItems = [
            ...list,
            ...allergensArr.filter((a: string) => !list.includes(a))
          ];
          if (allItems.length === 0) {
            setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'No ingredients found for this barcode.' } : pr));
          } else {
            setSafeFoodProducts(p => p.map((pr, i) => i === idx ? {
              ...pr,
              isBarcodeLoading: false,
              barcodeError: '',
              commonList: [
                ...pr.commonList,
                ...allItems.filter((ing: string) => !pr.commonList.map(x => x.toLowerCase().trim()).includes(ing.toLowerCase().trim()))
              ]
            } : pr));
        }
      } else {
        setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'Product not found.' } : pr));
      }
    } catch (err) {
      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isBarcodeLoading: false, barcodeError: 'Error fetching barcode.' } : pr));
    }
  };

  const testFirebaseConnection = async () => {
    if (!user) return;
    
    try {
      console.log('Testing Firebase connection...');
      const testDoc = await addDoc(collection(db, 'test'), {
        uid: user.uid,
        timestamp: serverTimestamp(),
        test: true
      });
      console.log('Firebase test successful, document ID:', testDoc.id);
      
      // Clean up test document
      // Note: In production, you might want to keep this for debugging
      // await deleteDoc(doc(db, 'test', testDoc.id));
    } catch (error) {
      console.error('Firebase connection test failed:', error);
    }
  };

  // Test Firebase connection on component mount
  useEffect(() => {
    testFirebaseConnection();
  }, [user]);

  // Submit safe food log
  const submitSafeFoodLog = async () => {
    if (!user || isSafeFoodSubmitting) return;
    setIsSafeFoodSubmitting(true);
    
    try {
      console.log('Starting safe food log submission...');
      console.log('User:', user.uid);
      console.log('Time:', safeFoodTime);
      
      // Validate required fields
      if (!safeFoodTime) {
        alert('Please fill in the time field.');
        setIsSafeFoodSubmitting(false);
        return;
      }
      
      // Prepare safe food log data
      const safeFoodData = {
        uid: user.uid,
        time: safeFoodTime,
        type: 'safe_food',
        products: safeFoodProducts.map(product => ({
          name: product.name || '',
          exposureType: product.exposureType || '',
          commonList: product.commonList || [],
          barcode: product.barcode || '',
          manualIngredient: product.manualIngredient || '',
          scanText: product.scanText || '',
          entryMode: product.entryMode || null
        })),
        createdAt: serverTimestamp(),
      };
      
      console.log('Submitting safe food log with data:', safeFoodData);
      
      // Submit to safe_foods collection
      const docRef = await addDoc(collection(db, 'safe_foods'), safeFoodData);
      console.log('Safe food log submitted successfully with ID:', docRef.id);
      
      // Verify the document was created
      const savedDoc = await getDoc(docRef);
      if (savedDoc.exists()) {
        console.log('Safe food document verified in Firebase:', savedDoc.data());
        setSafeFoodStep(3); // Go to success step
      } else {
        throw new Error('Safe food document was not created properly');
      }
      
    } catch (error) {
      console.error('Error submitting safe food log:', error);
      alert(`Failed to save safe food log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSafeFoodSubmitting(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />
      <main className="dashboard-main log-reaction-main">
        <div className="log-reaction-landing">
          {step === 0 && safeFoodStep === 0 ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '2rem', 
              width: '100%', 
              maxWidth: '1200px'
            }}>
              {/* Log a New Condition Card */}
            <div className="log-reaction-card">
              <div className="log-reaction-icon">
                  <ClipboardCheck size={48} />
              </div>
              <h1 className="log-reaction-title">Log a New Condition</h1>
              <p className="log-reaction-desc">Log new allergy symptoms in seconds. Keep your health records current and give your care team precise, real-time insights.</p>
              <button className="log-reaction-btn" onClick={() => setStep(1)}>Begin Logging</button>
            </div>

              {/* Log Safe Food Card */}
              <div className="log-reaction-card">
                <div className="log-reaction-icon">
                  <CheckCircle size={48} />
                </div>
                <h1 className="log-reaction-title">Log Safe Food</h1>
                <p className="log-reaction-desc">Record foods that you've safely consumed without any allergic reactions. This helps improve your allergen analysis by excluding safe ingredients.</p>
                <button className="log-reaction-btn" onClick={() => setSafeFoodStep(1)}>Begin Logging</button>
              </div>
            </div>
          ) : step === 1 ? (
            <div className="log-reaction-card step-card">
              <div className="log-reaction-icon">
                <ClipboardCheck size={40} />
              </div>
              <h2 className="log-reaction-title">Step 1: Condition Details</h2>
              <form className="log-reaction-form" onSubmit={handleStep1Submit}>
                <label className="log-reaction-label">
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Time of Condition</span>
                  <input type="datetime-local" className="log-reaction-input" value={time} onChange={e => setTime(e.target.value)} required />
                </label>
                <label className="log-reaction-label">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ textAlign: 'center', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Severity Grading:</span>
                      <span style={{fontWeight: 400, color: '#64748b'}}>{severity}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScaleInterpretation(!showScaleInterpretation)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        padding: 0,
                        margin: 0
                      }}
                    >
                      scale interpretation
                    </button>
                  </div>
                  {showScaleInterpretation && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      border: '1px solid #bae6fd',
                      borderRadius: 8,
                      padding: '12px 16px',
                      marginBottom: 12,
                      fontSize: '14px',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#0c4a6e' }}>Severity Scale Interpretation:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div><strong>1</strong> = Mild (minimal discomfort)</div>
                        <div><strong>2</strong> = Mild-Moderate</div>
                        <div><strong>3</strong> = Moderate</div>
                        <div><strong>4</strong> = Severe (urgent evaluation advised)</div>
                        <div><strong>5</strong> = Critical (emergent intervention required)</div>
                      </div>
                    </div>
                  )}
                  <input type="range" min={1} max={5} step={0.1} value={severity} onChange={e => setSeverity(Number(e.target.value))} className="log-reaction-slider" />
                  <div className="log-reaction-severity-labels">
                    <span>Mild</span>
                    <span>Severe</span>
                  </div>
                </label>
                <label className="log-reaction-label">
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Symptoms (select all that apply)</span>
                  <div className="log-reaction-symptom-options" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {symptomCategories.map((category, categoryIndex) => (
                      <div key={categoryIndex} style={{
                        border: category.isWarning ? '2px solid #ef4444' : '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '16px',
                        background: category.isWarning ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                      }}>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: category.isWarning ? '#dc2626' : '#374151'
                        }}>
                          {category.title}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {category.symptoms.map((symptom, symptomIndex) => (
                            <label key={symptomIndex} className="log-reaction-symptom-option" style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: symptoms.includes(symptom) ? (category.isWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                              border: symptoms.includes(symptom) ? (category.isWarning ? '1px solid #ef4444' : '1px solid #3b82f6') : '1px solid transparent',
                              transition: 'all 0.2s ease'
                            }}>
                              <input
                                type="checkbox"
                                checked={symptoms.includes(symptom)}
                                onChange={() => handleSymptomChange(symptom)}
                                style={{
                                  accentColor: category.isWarning ? '#ef4444' : '#3b82f6'
                                }}
                              />
                              <span style={{
                                fontSize: '14px',
                                color: category.isWarning ? '#991b1b' : '#374151',
                                fontWeight: symptoms.includes(symptom) ? 600 : 400
                              }}>
                                {symptom}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </label>
                <label className="log-reaction-label">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Symptom Description</span>
                    <button
                      type="button"
                      onClick={() => setShowPatientInstructions(!showPatientInstructions)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        padding: 0,
                        margin: 0
                      }}
                    >
                      Instructions for Patient
                    </button>
                  </div>
                  {showPatientInstructions && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      border: '1px solid #bae6fd',
                      borderRadius: 8,
                      padding: '16px 20px',
                      marginBottom: 12,
                      fontSize: '14px',
                      lineHeight: 1.6,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 12, color: '#0c4a6e', textAlign: 'center' }}>Instructions for Patient:</div>
                      <div style={{ color: '#1e293b', textAlign: 'left' }}>
                        Provide a detailed account of your symptoms to assist in accurate evaluation. Include the following (if applicable):
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
                        <div>
                          <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Symptom Characteristics:</strong>
                          <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                            <li><strong>Location:</strong> Where is the symptom occurring? (e.g., "Right forearm," "Both eyelids")</li>
                            <li><strong>Quality:</strong> What does it feel like? (e.g., burning, throbbing, stabbing, itching)</li>
                            <li><strong>Duration:</strong> How long has it persisted? (e.g., "2 hours," "Intermittent for 3 days")</li>
                          </ul>
                        </div>
                        <div>
                          <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Timing & Progression:</strong>
                          <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                            <li><strong>Onset:</strong> Did it start suddenly or gradually?</li>
                            <li><strong>Pattern:</strong> Constant vs. episodic? Worse at night/morning?</li>
                            <li><strong>Triggers/Aggravators:</strong> Activity, food, medication, environmental exposure?</li>
                          </ul>
                        </div>
                        <div>
                          <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Associated Symptoms:</strong>
                          <div style={{ margin: '8px 0 0 20px', textAlign: 'left' }}>
                            Any fever, nausea, dizziness, or concurrent skin/respiratory changes?
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Self-Management Attempted:</strong>
                          <div style={{ margin: '8px 0 0 20px', textAlign: 'left' }}>
                            Medications (OTC/prescription), topical treatments, or home remedies used.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <textarea 
                    className="log-reaction-textarea" 
                    value={symptomDesc} 
                    onChange={e => setSymptomDesc(e.target.value)} 
                    rows={3} 
                    placeholder="Sample response: Localized pruritic rash on left ankle for 24 hours, with erythema and mild swelling. No known triggers. Took 25mg diphenhydramine with partial relief." 
                    required
                  />
                </label>
                <button 
                  className="log-reaction-btn" 
                  type="submit" 
                  disabled={!time || symptoms.length === 0 || !symptomDesc.trim()}
                  onClick={() => console.log('Next button clicked')}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Next'}
                </button>
              </form>
            </div>
          ) : step === 2 ? (
            <div className="log-reaction-card step-card">
              <div className="log-reaction-icon">
                <Brain size={40} />
              </div>
              <h2 className="log-reaction-title">Step 2: Environmental Cause Analysis</h2>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <p className="environmental-instruction" style={{ textAlign: 'center', margin: 0 }}>
                    Describe any environmental factors or situations that may have contributed to this reaction in the past 48 hours:
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowEnvironmentalInstructions(!showEnvironmentalInstructions)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      padding: 0,
                      margin: 0
                    }}
                  >
                    Instructions for Patient
                  </button>
                </div>
                {showEnvironmentalInstructions && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    border: '1px solid #bae6fd',
                    borderRadius: 8,
                    padding: '16px 20px',
                    marginBottom: 16,
                    fontSize: '14px',
                    lineHeight: 1.6,
                    textAlign: 'left'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 12, color: '#0c4a6e', textAlign: 'center' }}>Instructions for Patient:</div>
                    <div style={{ color: '#1e293b', textAlign: 'left', marginBottom: 12 }}>
                      Describe any relevant exposures or circumstances in the instructed past hours. Be as specific as possible.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
                      <div>
                        <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Key Categories to Consider:</strong>
                      </div>
                      <div>
                        <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Outdoor/Indoor Allergens:</strong>
                        <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                          <li>Pollen levels, mold exposure, dust mites, animal dander (e.g., "Played with a cat yesterday").</li>
                          <li>Recent travel or visits to new environments (e.g., forests, construction sites).</li>
                        </ul>
                      </div>
                      <div>
                        <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Chemical/Irritant Exposure:</strong>
                        <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                          <li>Household cleaners, detergents, perfumes, or industrial chemicals.</li>
                          <li>New skincare products, cosmetics, or topical medications.</li>
                        </ul>
                      </div>
                      <div>
                        <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Weather/Environmental Conditions:</strong>
                        <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                          <li>Extreme temperatures (hot/cold), humidity, or air quality changes.</li>
                          <li>Sun exposure (duration/UV index) or high-altitude activities.</li>
                        </ul>
                      </div>
                      <div>
                        <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Lifestyle/Behavioral Factors:</strong>
                        <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                          <li>Stressful events, sleep deprivation, or dietary changes.</li>
                          <li>Physical activities (e.g., exercise-induced urticaria).</li>
                        </ul>
                      </div>
                      <div>
                        <strong style={{ color: '#0c4a6e', textAlign: 'center', display: 'block' }}>Occupational/Hobby-Related Triggers:</strong>
                        <ul style={{ margin: '8px 0 0 20px', padding: 0, textAlign: 'left' }}>
                          <li>Workplace exposures (e.g., latex gloves, solvents).</li>
                          <li>Gardening, painting, or crafting with new materials.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                <textarea
                  className="log-reaction-textarea environmental-textarea"
                  value={environmentalCause}
                  onChange={e => setEnvironmentalCause(e.target.value)}
                  rows={4}
                  placeholder="Sample input: Installed new carpet 36 hours ago; noticed itching and rash on arms 4 hours later. No prior allergies. Weather was humid (85%), and windows were closed."
                />
              <div className="step-navigation">
                <button className="log-reaction-btn secondary" onClick={() => setStep(1)}>
                  Back to Step 1
                </button>
                <button className="log-reaction-btn" onClick={() => setStep(3)}>
                  Move to Next Step
                </button>
              </div>
            </div>
          ) : step === 3 ? (
            <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 className="log-reaction-title" style={{ textAlign: 'center', marginBottom: 8 }}>Step 3: Document Exposures</h2>
              <p className="log-reaction-desc" style={{ textAlign: 'center', marginBottom: 24 }}>Accurately log all product ingredients or environmental substances you encountered in the past 48 hours. This helps identify potential allergens or irritants.</p>
              {products.map((product, idx) => (
                <div key={idx} style={{ width: '100%', maxWidth: 700, marginBottom: 24, borderRadius: 18, boxShadow: '0 8px 32px rgba(30,64,175,0.10)', background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ef 100%)', padding: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#3b82f6', color: '#fff', padding: '1.1rem 2rem', cursor: 'pointer' }} onClick={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, expanded: !pr.expanded } : pr))}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>
                      {product.name ? product.name : `Product ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 22 }}>{product.expanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}</div>
                  </div>
                  {product.expanded && (
                    <div style={{ padding: '2.2rem 2.2rem 2.2rem 2.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <input
                        className="log-reaction-input"
                        style={{ marginBottom: 18, maxWidth: 340 }}
                        type="text"
                        placeholder="Product name (optional)"
                        value={product.name}
                        onChange={e => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, name: e.target.value } : pr))}
                      />
                      <div style={{ marginBottom: 36, width: '100%', maxWidth: 340 }}>
                        <label className="log-reaction-label">Exposure Type</label>
                        <select
                          className="log-reaction-input"
                          value={product.exposureType}
                          onChange={e => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, exposureType: e.target.value } : pr))}
                          style={{ marginBottom: 8 }}
                        >
                          <option value="">Select type...</option>
                          <option value="Food">Food</option>
                          <option value="Cosmetics">Cosmetics</option>
                          <option value="Medication">Medication</option>
                          <option value="Seasonal Allergens">Seasonal Allergens</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                      {product.exposureType === 'Food' && (
                        <div style={{ marginBottom: 36, width: '100%', maxWidth: 340 }}>
                          <label className="log-reaction-label">Food Type</label>
                          <select
                            className="log-reaction-input"
                            value={product.foodType || ''}
                            onChange={e => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, foodType: e.target.value } : pr))}
                            style={{ marginBottom: 8 }}
                          >
                            <option value="">Select food type...</option>
                            <option value="Packaged/Processed">Packaged/Processed</option>
                            <option value="Whole Food (Fruit/Vegetable)">Whole Food (Fruit/Vegetable)</option>
                            <option value="Animal Product (Dairy/Meat/Fish)">Animal Product (Dairy/Meat/Fish)</option>
                            <option value="Mixed Dish (e.g., Casseroles)">Mixed Dish (e.g., Casseroles)</option>
                            <option value="Beverage">Beverage</option>
                          </select>
                          <div style={{ 
                            fontSize: 14, 
                            color: '#6b7280', 
                            textAlign: 'left',
                            marginTop: 8,
                            lineHeight: 1.4
                          }}>
                            For packaged foods: Photograph ingredient label or manually enter<br/>
                            For whole foods: Note preparation method (raw/cooked/processed)
                          </div>
                        </div>
                      )}
                      {product.exposureType && (
                        <div style={{ marginBottom: 16, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: 32, marginTop: 16 }}>
                            <button
                              className={`log-reaction-btn${product.entryMode === 'manual' ? ' selected' : ''}`}
                              type="button"
                              style={{ minWidth: 140, background: product.entryMode === 'manual' ? 'linear-gradient(90deg,#2563eb,#38bdf8)' : undefined }}
                              onClick={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, entryMode: 'manual' } : pr))}
                            >
                              Manual Entry
                            </button>
                            <button
                              className={`log-reaction-btn${product.entryMode === 'scan' ? ' selected' : ''}`}
                              type="button"
                              style={{ minWidth: 140, background: product.entryMode === 'scan' ? 'linear-gradient(90deg,#2563eb,#38bdf8)' : undefined }}
                              onClick={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, entryMode: 'scan' } : pr))}
                            >
                              Scan Ingredients
                            </button>
                            <button
                              className={`log-reaction-btn${product.entryMode === 'barcode' ? ' selected' : ''}`}
                              type="button"
                              style={{ minWidth: 140, background: product.entryMode === 'barcode' ? 'linear-gradient(90deg,#2563eb,#38bdf8)' : undefined }}
                              onClick={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, entryMode: 'barcode' } : pr))}
                            >
                              Scan Barcode
                            </button>
                          </div>
                          {/* Manual Entry */}
                          {product.entryMode === 'manual' && (
                            <div style={{ marginBottom: 36, width: '100%' }}>
                              <label className="log-reaction-label">Add Ingredient Manually</label>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  className="log-reaction-input"
                                  type="text"
                                  value={product.manualIngredient}
                                  onChange={e => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, manualIngredient: e.target.value } : pr))}
                                  placeholder="Enter ingredients one by one, click 'add' after each ingredient"
                                  style={{ flex: 1 }}
                                />
                                <button
                                  className="log-reaction-btn"
                                  type="button"
                                  style={{ minWidth: 60 }}
                                  onClick={() => {
                                    if (product.manualIngredient.trim()) {
                                      setProducts(p => p.map((pr, i) => i === idx ? { ...pr, commonList: pr.commonList.includes(product.manualIngredient.trim().toLowerCase()) ? pr.commonList : [...pr.commonList, product.manualIngredient.trim().toLowerCase()], manualIngredient: '' } : pr));
                                    }
                                  }}
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Scan Ingredients */}
                          {product.entryMode === 'scan' && (
                            <div style={{ marginBottom: 36, width: '100%' }}>
                              <label className="log-reaction-label">Scan Ingredients from Product</label>
                              <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)',
                                border: '1.5px solid #c7d2fe',
                                borderRadius: 16,
                                padding: '1.2rem 1rem',
                                marginBottom: 12,
                                boxShadow: '0 2px 12px rgba(30,64,175,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 16
                              }}>
                                <label htmlFor={`scan-file-input-${idx}`} style={{
                                  background: 'linear-gradient(90deg, #3b82f6 0%, #1e40af 100%)',
                                  color: '#fff',
                                  borderRadius: 8,
                                  padding: '0.7rem 1.5rem',
                                  fontWeight: 600,
                                  fontSize: 16,
                                  cursor: 'pointer',
                                  marginBottom: 8,
                                  boxShadow: '0 2px 8px rgba(59,130,246,0.10)',
                                  transition: 'background 0.2s',
                                  display: 'inline-block',
                                }}>
                                  {product.isScanning ? 'Uploading...' : 'Choose Image'}
                                  <input
                                    id={`scan-file-input-${idx}`}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={async e => {
                                      const file = e.target.files && e.target.files[0];
                                      setProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanText: '', scanError: '', hasProcessedScanText: false } : pr));
                                      if (!file) return;
                                      setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isScanning: true } : pr));
                                      try {
                                        const formData = new FormData();
                                        formData.append('image', file);
                                        const response = await fetch('https://api.api-ninjas.com/v1/imagetotext', {
                                          method: 'POST',
                                          headers: {
                                            'X-Api-Key': 'K5j9BQ5tst4tX5LYvHj1XQ==9cihtgtz6eD4DL0s',
                                          },
                                          body: formData,
                                        });
                                        if (!response.ok) throw new Error('Failed to detect text.');
                                        const data = await response.json();
                                        if (Array.isArray(data) && data.length > 0 && data[0].text) {
                                          setProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanText: data.map((item: any) => item.text).join(' '), hasProcessedScanText: false } : pr));
                                        } else {
                                          setProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanError: 'No ingredient detected.' } : pr));
                                        }
                                      } catch (err: any) {
                                        setProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanError: 'Error detecting text from image.' } : pr));
                                      } finally {
                                        setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isScanning: false } : pr));
                                      }
                                    }}
                                  />
                                </label>
                                {product.isScanning && <div style={{ color: '#0ea5e9', fontWeight: 600, fontSize: 16, marginBottom: 8, letterSpacing: 0.5 }}>Detecting text...</div>}
                                {product.scanError && <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{product.scanError}</div>}
                              </div>
                              {/* AI extraction and auto-add logic for each product */}
                              {(() => {
                                if (product.scanText && !product.isListing && !product.listError && !product.isEditingOrDeleting && !product.hasProcessedScanText) {
                                  // Helper to check if an item is deleted
                                  const isDeleted = (item: string) => product.deletedItemsRef.includes(item.toLowerCase().trim());
                                  (async () => {
                                    setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isListing: true, listError: '', hasProcessedScanText: true } : pr));
                                    try {
                                      const groqResponse = await GroqService.extractIngredients(product.scanText);
                                      const list = cleanAIResponse(groqResponse);
                                        if (list.length === 0) {
                                          const scanTextLower = product.scanText.trim().toLowerCase();
                                          setProducts(p => p.map((pr, i) => i === idx ? {
                                            ...pr,
                                            commonList: pr.commonList.map(i => i.toLowerCase().trim()).includes(scanTextLower) || isDeleted(product.scanText) ? pr.commonList : [...pr.commonList, product.scanText.trim().toLowerCase()]
                                          } : pr));
                                        } else {
                                          setProducts(p => p.map((pr, i) => i === idx ? {
                                            ...pr,
                                            commonList: [
                                              ...pr.commonList,
                                              ...list.filter((i: string) => {
                                                const lower = i.toLowerCase().trim();
                                                return !pr.commonList.map(x => x.toLowerCase().trim()).includes(lower) && !isDeleted(i);
                                              })
                                            ]
                                          } : pr));
                                      }
                                    } catch (err: any) {
                                      const scanTextLower = product.scanText.trim().toLowerCase();
                                      setProducts(p => p.map((pr, i) => i === idx ? {
                                        ...pr,
                                        commonList: pr.commonList.map(i => i.toLowerCase().trim()).includes(scanTextLower) || isDeleted(product.scanText) ? pr.commonList : [...pr.commonList, product.scanText.trim().toLowerCase()]
                                      } : pr));
                                    } finally {
                                      setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isListing: false } : pr));
                                    }
                                  })();
                                }
                                return null;
                              })()}
                              {product.listError && product.listError !== 'Unable to extract ingredients.' && <div style={{ color: 'red', marginTop: 6 }}>{product.listError}</div>}
                            </div>
                          )}
                          {/* Scan Barcode */}
                          {product.entryMode === 'barcode' && (
                            <div style={{ marginBottom: 36, width: '100%' }}>
                              <label className="log-reaction-label">Scan Barcode</label>
                              <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)',
                                border: '1.5px solid #c7d2fe',
                                borderRadius: 16,
                                padding: '1.2rem 1rem',
                                marginBottom: 12,
                                boxShadow: '0 2px 12px rgba(30,64,175,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 16
                              }}>
                                <input
                                  className="log-reaction-input"
                                  type="text"
                                  placeholder="Enter barcode number..."
                                  value={product.barcode || ''}
                                  style={{ maxWidth: 220, marginBottom: 8, textAlign: 'center' }}
                                  onChange={e => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, barcode: e.target.value } : pr))}
                                  onKeyDown={e => { if (e.key === 'Enter') fetchBarcodeIngredients(idx); }}
                                />
                                <button
                                  className="log-reaction-btn"
                                  style={{ minWidth: 120, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                                  onClick={() => fetchBarcodeIngredients(idx)}
                                  disabled={product.isBarcodeLoading}
                                >
                                  {product.isBarcodeLoading ? 'Fetching...' : 'Fetch Ingredients'}
                                </button>
                                {product.barcodeError && <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{product.barcodeError}</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Common List Display */}
                      <div style={{ marginTop: 8, width: '100%', maxWidth: 700 }}>
                        <label className="log-reaction-label" style={{ marginBottom: 8 }}>Ingredients List</label>
                        <ul style={{ background: '#fff', borderRadius: 12, padding: '1rem', minHeight: 40, boxShadow: '0 2px 8px rgba(30,64,175,0.06)', listStyle: 'none', margin: 0 }}>
                          {product.commonList.length === 0 ? (
                            <li style={{ color: '#64748b', textAlign: 'center' }}>No ingredients documented yet.</li>
                          ) : (
                            product.commonList.map((item, iidx) => (
                              <li key={iidx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 0', borderBottom: iidx !== product.commonList.length - 1 ? '1px solid #e0e7ef' : 'none' }}>
                                {product.editIndex === iidx ? (
                                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <input
                                      className="log-reaction-input"
                                      style={{ flex: 1, marginRight: 8 }}
                                      value={product.editValue}
                                      onChange={e => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, editValue: e.target.value } : pr))}
                                      onFocus={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, isEditingOrDeleting: true } : pr))}
                                    />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button
                                        className="log-reaction-btn"
                                        style={{ minWidth: 50, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                                        onClick={() => {
                                          if (product.editValue.trim()) {
                                            setProducts(p => p.map((pr, i) => i === idx ? {
                                              ...pr,
                                              commonList: pr.commonList.map((v, j) => j === iidx ? pr.editValue.trim().toLowerCase() : v),
                                              editIndex: null,
                                              editValue: '',
                                              isEditingOrDeleting: false
                                            } : pr));
                                          }
                                        }}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="log-reaction-btn secondary"
                                        style={{ minWidth: 50, background: 'linear-gradient(90deg,#64748b,#475569)' }}
                                        onClick={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, editIndex: null, editValue: '', isEditingOrDeleting: false } : pr))}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span style={{ flex: 1, fontWeight: 500, color: '#334155' }}>{item}</span>
                                    <button
                                      className="log-reaction-btn"
                                      style={{ minWidth: 50, marginRight: 4, background: 'linear-gradient(90deg,#f59e42,#fbbf24)' }}
                                      onClick={() => setProducts(p => p.map((pr, i) => i === idx ? { ...pr, editIndex: iidx, editValue: item } : pr))}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="log-reaction-btn secondary"
                                      style={{ minWidth: 50, background: 'linear-gradient(90deg,#ef4444,#dc2626)' }}
                                      onClick={() => {
                                        setProducts(p => p.map((pr, i) => {
                                          if (i === idx) {
                                            const toDelete = pr.commonList[iidx];
                                            const lower = toDelete.toLowerCase().trim();
                                            return {
                                              ...pr,
                                              commonList: pr.commonList.filter((_, j) => j !== iidx),
                                              deletedItemsRef: pr.deletedItemsRef.includes(lower) ? pr.deletedItemsRef : [...pr.deletedItemsRef, lower],
                                              editIndex: pr.editIndex === iidx ? null : pr.editIndex,
                                              editValue: pr.editIndex === iidx ? '' : pr.editValue,
                                            };
                                          }
                                          return pr;
                                        }));
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                      <button className="log-reaction-btn secondary" style={{ marginTop: 18, background: 'linear-gradient(90deg,#64748b,#475569)' }} onClick={() => setProducts(p => p.filter((_, i) => i !== idx))}>Remove Product</button>
                    </div>
                  )}
                </div>
              ))}
              <button className="log-reaction-btn" style={{ marginTop: 24, maxWidth: 300 }} onClick={() => setProducts(p => [...p, {
                exposureType: '',
                foodType: '',
                manualIngredient: '',
                commonList: [],
                scanText: '',
                isScanning: false,
                scanError: '',
                isListing: false,
                listError: '',
                entryMode: null as 'manual' | 'scan' | 'barcode' | null,
                editIndex: null,
                editValue: '',
                isEditingOrDeleting: false,
                deletedItemsRef: [],
                expanded: true,
                name: '',
                barcode: '',
                barcodeError: '',
                isBarcodeLoading: false,
                hasProcessedScanText: false,
              }])}>Add Product</button>
              <div className="step-navigation" style={{ marginTop: 32, width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'space-between' }}>
                <button className="log-reaction-btn secondary" onClick={() => setStep(2)}>
                  Back to Step 2
                </button>
                <button className="log-reaction-btn" onClick={() => setStep(4)}>
                  Review & Confirm
                </button>
              </div>
            </div>
          ) : step === 4 ? (
            <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
                <div style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #38bdf8 100%)',
                  borderRadius: '50%',
                  width: 70,
                  height: 70,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 24px rgba(34,197,94,0.12)',
                  marginBottom: 12
                }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <h2 className="log-reaction-title" style={{ textAlign: 'center', marginBottom: 4, fontWeight: 800, fontSize: 32, color: '#0ea5e9', letterSpacing: 0.5 }}>Step 4: Review & Confirm Your Submission</h2>
                <p className="log-reaction-desc" style={{ textAlign: 'left', marginBottom: 18, color: '#64748b', fontSize: 18 }}>Before You Submit:<br/>
✔ Verify your symptom details (type, severity, timing)<br/>
✔ Double-check exposure logs (products, ingredients, exposure routes)<br/>
✔ Ensure environmental factors (triggers, activities) are complete<br/><br/>
<span style={{ fontWeight: 'bold' }}>Noticed an error?</span> Use the Back button to make corrections.<br/>
<span style={{ fontWeight: 'bold' }}>Ready?</span> Select Submit to send your information securely to your healthcare provider.</p>
              </div>
              {/* Reaction Summary */}
              <div style={{ width: '100%', maxWidth: 700, marginBottom: 32, borderRadius: 22, boxShadow: '0 8px 32px rgba(30,64,175,0.10)', background: 'linear-gradient(135deg, #f0fdfa 0%, #e0e7ef 100%)', padding: '2.2rem 2rem', border: '1.5px solid #38bdf8', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ color: '#0ea5e9', fontWeight: 800, fontSize: 22, marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Reaction Details</h3>
                <div style={{ display: 'grid', gap: 18, justifyItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ fontWeight: 700, color: '#334155', fontSize: 15, letterSpacing: 0.2 }}>Time of Reaction</label>
                    <p style={{ color: '#1e293b', marginTop: 4, fontSize: 16 }}>{time ? new Date(time).toLocaleString() : 'Not specified'}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ fontWeight: 700, color: '#334155', fontSize: 15, letterSpacing: 0.2 }}>Severity Level</label>
                    <p style={{ color: '#1e293b', marginTop: 4, fontSize: 16 }}>{severity}/10</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ fontWeight: 700, color: '#334155', fontSize: 15, letterSpacing: 0.2 }}>Symptoms</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4, justifyContent: 'center' }}>
                      {symptoms.map((symptom, idx) => (
                        <span key={idx} style={{ background: 'linear-gradient(90deg,#38bdf8 0%,#0ea5e9 100%)', color: '#fff', padding: '5px 16px', borderRadius: 18, fontSize: 15, fontWeight: 600, boxShadow: '0 2px 8px rgba(56,189,248,0.10)' }}>
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                  {symptomDesc && (
                    <div style={{ textAlign: 'center' }}>
                      <label style={{ fontWeight: 700, color: '#334155', fontSize: 15, letterSpacing: 0.2 }}>Additional Description</label>
                      <p style={{ color: '#1e293b', marginTop: 4, fontSize: 16 }}>{symptomDesc}</p>
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ fontWeight: 700, color: '#334155', fontSize: 15, letterSpacing: 0.2 }}>Environmental Cause</label>
                    <p style={{ color: '#1e293b', marginTop: 4, fontSize: 16 }}>{environmentalCause || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              {/* Products Summary */}
              <div style={{ width: '100%', maxWidth: 700, marginBottom: 32, borderRadius: 22, boxShadow: '0 8px 32px rgba(30,64,175,0.10)', background: 'linear-gradient(135deg, #f0fdfa 0%, #e0e7ef 100%)', padding: '2.2rem 2rem', border: '1.5px solid #38bdf8', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', opacity: 0.12, fontSize: 60, textAlign: 'center' }}><Utensils size={60} /></div>
                <h3 style={{ color: '#0ea5e9', fontWeight: 800, fontSize: 22, marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Exposure Information</h3>
                {products.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center' }}>No products logged</p>
                ) : (
                  <div style={{ display: 'grid', gap: 24, justifyItems: 'center' }}>
                    {products.map((product, idx) => (
                      <div key={idx} style={{ background: 'linear-gradient(90deg,#fff 0%,#f0fdfa 100%)', borderRadius: 14, padding: 18, border: '1.5px solid #e0e7ef', boxShadow: '0 2px 8px rgba(30,64,175,0.06)', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ fontWeight: 700, color: '#0ea5e9', marginBottom: 8, fontSize: 18, letterSpacing: 0.2, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                          {product.name || `Product ${idx + 1}`}
                        </h4>
                        {product.exposureType && (
                          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 8, fontWeight: 500, textAlign: 'center' }}>
                            Type: {product.exposureType}
                          </p>
                        )}
                        {product.barcode && (
                          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 8, fontWeight: 500, textAlign: 'center' }}>
                            Barcode: {product.barcode}
                          </p>
                        )}
                        {product.commonList.length > 0 && (
                          <div style={{ marginBottom: 16, width: '100%' }}>
                            <label className="log-reaction-label" style={{ marginBottom: 8 }}>Ingredient List</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, justifyContent: 'center' }}>
                              {product.commonList.map((ingredient, iidx) => (
                                <span key={iidx} style={{ background: 'linear-gradient(90deg,#bae6fd 0%,#0ea5e9 100%)', color: '#0e7490', padding: '5px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 1px 4px rgba(14,165,233,0.08)' }}>
                                  {ingredient}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
            </div>
          )}
              </div>
              <div className="step-navigation" style={{ marginTop: 32, width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'center', gap: 24 }}>
                <button className="log-reaction-btn secondary" style={{ fontWeight: 700, fontSize: 16, borderRadius: 10, padding: '0.7rem 2.2rem', background: 'linear-gradient(90deg,#e0e7ef,#bae6fd)', color: '#0ea5e9', border: '1.5px solid #38bdf8' }} onClick={() => setStep(3)}>
                  Back to Step 3
                </button>
                <button
                  className="log-reaction-btn"
                  style={{ fontWeight: 800, fontSize: 18, borderRadius: 10, padding: '0.7rem 2.5rem', background: 'linear-gradient(90deg,#22c55e,#38bdf8)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.10)', border: 'none', opacity: isSubmitting ? 0.6 : 1, pointerEvents: isSubmitting ? 'none' : 'auto' }}
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (!user || isSubmitting) return;
                    setIsSubmitting(true);
                    
                    try {
                      console.log('Starting log submission...');
                      console.log('User:', user.uid);
                      console.log('Time:', time);
                      console.log('Severity:', severity);
                      console.log('Symptoms:', symptoms);
                      
                      // Validate required fields
                      if (!time || !severity || symptoms.length === 0) {
                        alert('Please fill in all required fields: time, severity, and symptoms.');
                        setIsSubmitting(false);
                        return;
                      }
                      
                      // Prepare log data
                      const logData = {
                        uid: user.uid,
                        time: time,
                        severity: severity,
                        symptoms: symptoms,
                        symptomDesc: symptomDesc || '',
                        aiAnalysis: aiAnalysis || '',
                        products: products.map(product => ({
                          name: product.name || '',
                          exposureType: product.exposureType || '',
                          commonList: product.commonList || [],
                          barcode: product.barcode || '',
                          manualIngredient: product.manualIngredient || '',
                          scanText: product.scanText || '',
                          entryMode: product.entryMode || null
                        })),
                        environmentalCause: environmentalCause || '',
                        createdAt: serverTimestamp(),
                      };
                      
                      console.log('Submitting log with data:', logData);
                      console.log('Firebase collection path:', 'logs');
                      
                      // Test Firebase connection first
                      console.log('Testing Firebase connection before submission...');
                      const testDoc = await addDoc(collection(db, 'test'), {
                        uid: user.uid,
                        timestamp: new Date().toISOString(),
                        test: true
                      });
                      console.log('Firebase test successful, document ID:', testDoc.id);
                      
                      // Now submit the actual log
                      const docRef = await addDoc(collection(db, 'logs'), logData);
                      console.log('Log submitted successfully with ID:', docRef.id);
                      
                      // Verify the document was created
                      const savedDoc = await getDoc(docRef);
                      if (savedDoc.exists()) {
                        console.log('Document verified in Firebase:', savedDoc.data());
                        alert('Log saved successfully! Document ID: ' + docRef.id);
                        setStep(5);
                      } else {
                        throw new Error('Document was not created properly');
                      }
                      
                    } catch (error) {
                      console.error('Error submitting log:', error);
                      console.error('Error details:', {
                        message: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                        user: user?.uid,
                        time: time,
                        severity: severity
                      });
                      alert(`Failed to save log: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the browser console for more details.`);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? 'Submitting...' : <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: 'middle', marginBottom: 2 }}><polyline points="20 6 9 17 4 12"/></svg>Next</span>}
                </button>
              </div>
            </div>
          ) : step === 5 ? (
            <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', borderRadius: 28, background: 'linear-gradient(135deg, #e0f7fa 0%, #bae6fd 100%)', boxShadow: '0 8px 32px rgba(30,64,175,0.13)', border: '2px solid #38bdf8', position: 'relative', minHeight: 420 }}>
              <div style={{ marginBottom: 24 }}>
                <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2 style={{ color: '#0ea5e9', fontWeight: 800, fontSize: 32, marginBottom: 12 }}>Submitted!</h2>
              <p style={{ color: '#64748b', fontSize: 18, marginBottom: 24 }}>Exposure documentation successful!</p>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22, marginTop: 32 }}>
                <button
                  className="log-reaction-btn"
                  style={{ fontWeight: 800, fontSize: 18, borderRadius: 10, padding: '0.7rem 2.5rem', background: 'linear-gradient(90deg,#22c55e,#38bdf8)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.10)', border: 'none', opacity: 1, pointerEvents: 'auto' }}
                  onClick={() => navigate('/dashboard/analysis')}
                >
                  <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: 'middle', marginBottom: 2 }}><polyline points="20 6 9 17 4 12"/></svg>Go to Analysis</span>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>See AI insights and trends from your logs</div>
                </button>
                <button
                  className="log-reaction-btn"
                  style={{ fontWeight: 800, fontSize: 18, borderRadius: 10, padding: '0.7rem 2.5rem', background: 'linear-gradient(90deg,#22c55e,#38bdf8)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.10)', border: 'none', opacity: 1, pointerEvents: 'auto' }}
                  onClick={() => navigate('/dashboard/history')}
                >
                  <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: 'middle', marginBottom: 2 }}><polyline points="20 6 9 17 4 12"/></svg>Go to History</span>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>View and edit all your past logs</div>
                </button>
              </div>
            </div>
          ) : null}
          
          {/* Safe Food Steps */}
          {safeFoodStep === 1 ? (
            <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 className="log-reaction-title" style={{ textAlign: 'center', marginBottom: 8 }}>Step 1: Log Safe Food Ingredients</h2>
              <p className="log-reaction-desc" style={{ textAlign: 'center', marginBottom: 24 }}>Log the ingredients of foods you've safely consumed without any allergic reactions.</p>
              
              {/* Time Input */}
              <div style={{ width: '100%', maxWidth: 400, marginBottom: 32 }}>
                <label className="log-reaction-label">
                  Time of Consumption
                  <input 
                    type="datetime-local" 
                    className="log-reaction-input" 
                    value={safeFoodTime} 
                    onChange={e => setSafeFoodTime(e.target.value)} 
                    required 
                  />
                </label>
              </div>
              
              {safeFoodProducts.map((product, idx) => (
                <div key={idx} style={{ width: '100%', maxWidth: 700, marginBottom: 24, borderRadius: 18, boxShadow: '0 8px 32px rgba(30,64,175,0.10)', background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ef 100%)', padding: 0, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#22c55e', color: '#fff', padding: '1.1rem 2rem', cursor: 'pointer' }} onClick={() => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, expanded: !pr.expanded } : pr))}>
                    <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 18 }}>
                      {product.name ? product.name : `Safe Food ${idx + 1}`}
                      <button
                        onClick={e => { e.stopPropagation(); setSafeFoodProducts(p => p.filter((_, i) => i !== idx)); }}
                        title="Remove Product"
                        style={{
                          marginLeft: 12,
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.18)',
                          transition: 'all 0.2s ease',
                          zIndex: 10,
                          fontSize: 16
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                    <div style={{ fontSize: 22 }}>{product.expanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}</div>
                  </div>
                  {product.expanded && (
                    <div style={{ padding: '2.2rem 2.2rem 2.2rem 2.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <input
                        className="log-reaction-input"
                        style={{ marginBottom: 18, maxWidth: 340 }}
                        type="text"
                        placeholder="Food name (optional)"
                        value={product.name}
                        onChange={e => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, name: e.target.value } : pr))}
                      />
                      <div style={{ marginBottom: 36, width: '100%', maxWidth: 340 }}>
                        <label className="log-reaction-label">Food Type</label>
                        <select
                          className="log-reaction-input"
                          value={product.foodType || ''}
                          onChange={e => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, foodType: e.target.value } : pr))}
                          style={{ marginBottom: 8 }}
                        >
                          <option value="">Select type...</option>
                          <option value="Packaged/Processed">Packaged/Processed</option>
                          <option value="Whole Food (Fruit/Vegetable)">Whole Food (Fruit/Vegetable)</option>
                          <option value="Animal Product (Dairy/Meat/Fish)">Animal Product (Dairy/Meat/Fish)</option>
                          <option value="Mixed Dish (e.g., Casseroles)">Mixed Dish (e.g., Casseroles)</option>
                          <option value="Beverage">Beverage</option>
                        </select>
                        <div style={{ 
                          fontSize: 13, 
                          color: '#64748b', 
                          marginTop: 6,
                          lineHeight: 1.4,
                          fontStyle: 'italic',
                          textAlign: 'left'
                        }}>
                          <div>• For packaged foods: Photograph ingredient label or manually enter</div>
                          <div>• For whole foods: Note preparation method (raw/cooked/processed)</div>
                        </div>
                      </div>
                      {product.foodType && (
                        <div style={{ marginBottom: 16, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: 32, marginTop: 16 }}>
                            <button
                              className={`log-reaction-btn${product.entryMode === 'manual' ? ' selected' : ''}`}
                              type="button"
                              style={{ minWidth: 140, background: product.entryMode === 'manual' ? 'linear-gradient(90deg,#22c55e,#16a34a)' : undefined }}
                              onClick={() => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, entryMode: 'manual' } : pr))}
                            >
                              Manual Entry
                            </button>
                            <button
                              className={`log-reaction-btn${product.entryMode === 'scan' ? ' selected' : ''}`}
                              type="button"
                              style={{ minWidth: 140, background: product.entryMode === 'scan' ? 'linear-gradient(90deg,#22c55e,#16a34a)' : undefined }}
                              onClick={() => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, entryMode: 'scan' } : pr))}
                            >
                              Scan Ingredients
                            </button>
                            <button
                              className={`log-reaction-btn${product.entryMode === 'barcode' ? ' selected' : ''}`}
                              type="button"
                              style={{ minWidth: 140, background: product.entryMode === 'barcode' ? 'linear-gradient(90deg,#22c55e,#16a34a)' : undefined }}
                              onClick={() => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, entryMode: 'barcode' } : pr))}
                            >
                              Scan Barcode
                            </button>
                          </div>
                          
                          {/* Manual Entry */}
                          {product.entryMode === 'manual' && (
                            <div style={{ marginBottom: 36, width: '100%' }}>
                              <label className="log-reaction-label">Add Ingredient Manually</label>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  className="log-reaction-input"
                                  type="text"
                                  value={product.manualIngredient}
                                  onChange={e => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, manualIngredient: e.target.value } : pr))}
                                  placeholder="Enter ingredients one by one, click 'add' after each ingredient"
                                  style={{ flex: 1 }}
                                />
                                <button
                                  className="log-reaction-btn"
                                  type="button"
                                  style={{ minWidth: 60, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                                  onClick={() => {
                                    if (product.manualIngredient.trim()) {
                                      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, commonList: pr.commonList.includes(product.manualIngredient.trim().toLowerCase()) ? pr.commonList : [...pr.commonList, product.manualIngredient.trim().toLowerCase()], manualIngredient: '' } : pr));
                                    }
                                  }}
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Scan Ingredients */}
                          {product.entryMode === 'scan' && (
                            <div style={{ marginBottom: 36, width: '100%' }}>
                              <label className="log-reaction-label">Scan Ingredients from Product</label>
                              <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)',
                                border: '1.5px solid #c7d2fe',
                                borderRadius: 16,
                                padding: '1.2rem 1rem',
                                marginBottom: 12,
                                boxShadow: '0 2px 12px rgba(30,64,175,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 16
                              }}>
                                <label htmlFor={`safe-food-scan-file-input-${idx}`} style={{
                                  background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                  color: '#fff',
                                  borderRadius: 8,
                                  padding: '0.7rem 1.5rem',
                                  fontWeight: 600,
                                  fontSize: 16,
                                  cursor: 'pointer',
                                  marginBottom: 8,
                                  boxShadow: '0 2px 8px rgba(34,197,94,0.10)',
                                  transition: 'background 0.2s',
                                  display: 'inline-block',
                                }}>
                                  {product.isScanning ? 'Uploading...' : 'Choose Image'}
                                  <input
                                    id={`safe-food-scan-file-input-${idx}`}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={async e => {
                                      const file = e.target.files && e.target.files[0];
                                      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanText: '', scanError: '', hasProcessedScanText: false } : pr));
                                      if (!file) return;
                                      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isScanning: true } : pr));
                                      try {
                                        const formData = new FormData();
                                        formData.append('image', file);
                                        const response = await fetch('https://api.api-ninjas.com/v1/imagetotext', {
                                          method: 'POST',
                                          headers: {
                                            'X-Api-Key': 'K5j9BQ5tst4tX5LYvHj1XQ==9cihtgtz6eD4DL0s',
                                          },
                                          body: formData,
                                        });
                                        if (!response.ok) throw new Error('Failed to detect text.');
                                        const data = await response.json();
                                        if (Array.isArray(data) && data.length > 0 && data[0].text) {
                                          setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanText: data.map((item: any) => item.text).join(' '), hasProcessedScanText: false } : pr));
                                        } else {
                                          setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanError: 'No ingredient detected.' } : pr));
                                        }
                                      } catch (err: any) {
                                        setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, scanError: 'Error detecting text from image.' } : pr));
                                      } finally {
                                        setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isScanning: false } : pr));
                                      }
                                    }}
                                  />
                                </label>
                                {product.isScanning && <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 16, marginBottom: 8, letterSpacing: 0.5 }}>Detecting text...</div>}
                                {product.scanError && <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{product.scanError}</div>}
                              </div>
                              {/* AI extraction and auto-add logic for each product */}
                              {(() => {
                                if (product.scanText && !product.isListing && !product.listError && !product.isEditingOrDeleting && !product.hasProcessedScanText) {
                                  // Helper to check if an item is deleted
                                  const isDeleted = (item: string) => product.deletedItemsRef.includes(item.toLowerCase().trim());
                                  (async () => {
                                    setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isListing: true, listError: '', hasProcessedScanText: true } : pr));
                                    try {
                                      const groqResponse = await GroqService.extractIngredients(product.scanText);
                                      const list = cleanAIResponse(groqResponse);
                                        if (list.length === 0) {
                                          const scanTextLower = product.scanText.trim().toLowerCase();
                                          setSafeFoodProducts(p => p.map((pr, i) => i === idx ? {
                                            ...pr,
                                            commonList: pr.commonList.map(i => i.toLowerCase().trim()).includes(scanTextLower) || isDeleted(product.scanText) ? pr.commonList : [...pr.commonList, product.scanText.trim().toLowerCase()]
                                          } : pr));
                                        } else {
                                          setSafeFoodProducts(p => p.map((pr, i) => i === idx ? {
                                            ...pr,
                                            commonList: [
                                              ...pr.commonList,
                                              ...list.filter((i: string) => {
                                                const lower = i.toLowerCase().trim();
                                                return !pr.commonList.map(x => x.toLowerCase().trim()).includes(lower) && !isDeleted(i);
                                              })
                                            ]
                                          } : pr));
                                      }
                                    } catch (err: any) {
                                      const scanTextLower = product.scanText.trim().toLowerCase();
                                      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? {
                                        ...pr,
                                        commonList: pr.commonList.map(i => i.toLowerCase().trim()).includes(scanTextLower) || isDeleted(product.scanText) ? pr.commonList : [...pr.commonList, product.scanText.trim().toLowerCase()]
                                      } : pr));
                                    } finally {
                                      setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isListing: false } : pr));
                                    }
                                  })();
                                }
                                return null;
                              })()}
                              {product.listError && product.listError !== 'Unable to extract ingredients.' && <div style={{ color: 'red', marginTop: 6 }}>{product.listError}</div>}
                            </div>
                          )}
                          
                          {/* Scan Barcode */}
                          {product.entryMode === 'barcode' && (
                            <div style={{ marginBottom: 36, width: '100%' }}>
                              <label className="log-reaction-label">Scan Barcode</label>
                              <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)',
                                border: '1.5px solid #c7d2fe',
                                borderRadius: 16,
                                padding: '1.2rem 1rem',
                                marginBottom: 12,
                                boxShadow: '0 2px 12px rgba(30,64,175,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 16
                              }}>
                                <input
                                  className="log-reaction-input"
                                  type="text"
                                  placeholder="Enter barcode number..."
                                  value={product.barcode || ''}
                                  style={{ maxWidth: 220, marginBottom: 8, textAlign: 'center' }}
                                  onChange={e => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, barcode: e.target.value } : pr))}
                                  onKeyDown={e => { if (e.key === 'Enter') fetchSafeFoodBarcodeIngredients(idx); }}
                                />
                                <button
                                  className="log-reaction-btn"
                                  style={{ minWidth: 120, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                                  onClick={() => fetchSafeFoodBarcodeIngredients(idx)}
                                  disabled={product.isBarcodeLoading}
                                >
                                  {product.isBarcodeLoading ? 'Fetching...' : 'Fetch Ingredients'}
                                </button>
                                {product.barcodeError && <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{product.barcodeError}</div>}
                              </div>
                            </div>
                          )}
                          
                          {/* Ingredient List Display */}
                          <div style={{ marginTop: 8, width: '100%', maxWidth: 700 }}>
                            <label className="log-reaction-label" style={{ marginBottom: 8 }}>Ingredient List</label>
                            <ul style={{ background: '#fff', borderRadius: 12, padding: '1rem', minHeight: 40, boxShadow: '0 2px 8px rgba(30,64,175,0.06)', listStyle: 'none', margin: 0 }}>
                              {product.commonList.length === 0 ? (
                                <li style={{ color: '#64748b', textAlign: 'center' }}>No ingredients documented yet.</li>
                              ) : (
                                product.commonList.map((item, iidx) => (
                                  <li key={iidx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 0', borderBottom: iidx !== product.commonList.length - 1 ? '1px solid #e0e7ef' : 'none' }}>
                                    {product.editIndex === iidx ? (
                                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <input
                                          className="log-reaction-input"
                                          style={{ flex: 1, marginRight: 8 }}
                                          value={product.editValue}
                                          onChange={e => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, editValue: e.target.value } : pr))}
                                          onFocus={() => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, isEditingOrDeleting: true } : pr))}
                                        />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                          <button
                                            className="log-reaction-btn"
                                            style={{ minWidth: 50, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                                            onClick={() => {
                                              if (product.editValue.trim()) {
                                                setSafeFoodProducts(p => p.map((pr, i) => i === idx ? {
                                                  ...pr,
                                                  commonList: pr.commonList.map((v, j) => j === iidx ? pr.editValue.trim().toLowerCase() : v),
                                                  editIndex: null,
                                                  editValue: '',
                                                  isEditingOrDeleting: true,
                                                } : pr));
                                              }
                                            }}
                                          >
                                            Save
                                          </button>
                                          <button
                                            className="log-reaction-btn secondary"
                                            style={{ minWidth: 50, background: 'linear-gradient(90deg,#ef4444,#dc2626)' }}
                                            onClick={() => {
                                              setSafeFoodProducts(p => p.map((pr, i) => {
                                                if (i === idx) {
                                                  const toDelete = pr.commonList[iidx];
                                                  const lower = toDelete.toLowerCase().trim();
                                                  return {
                                                    ...pr,
                                                    commonList: pr.commonList.filter((_, j) => j !== iidx),
                                                    deletedItemsRef: pr.deletedItemsRef.includes(lower) ? pr.deletedItemsRef : [...pr.deletedItemsRef, lower],
                                                    editIndex: pr.editIndex === iidx ? null : pr.editIndex,
                                                    editValue: pr.editIndex === iidx ? '' : pr.editValue,
                                                    isEditingOrDeleting: true,
                                                  };
                                                }
                                                return pr;
                                              }));
                                            }}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <span style={{ flex: 1, fontWeight: 500, color: '#fff' }}>{item}</span>
                                        <button
                                          className="log-reaction-btn"
                                          style={{ minWidth: 50, marginRight: 4, background: 'linear-gradient(90deg,#f59e42,#fbbf24)' }}
                                          onClick={() => setSafeFoodProducts(p => p.map((pr, i) => i === idx ? { ...pr, editIndex: iidx, editValue: item } : pr))}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className="log-reaction-btn secondary"
                                          style={{ minWidth: 50, background: 'linear-gradient(90deg,#ef4444,#dc2626)' }}
                                          onClick={() => {
                                            setSafeFoodProducts(p => p.map((pr, i) => {
                                              if (i === idx) {
                                                const toDelete = pr.commonList[iidx];
                                                const lower = toDelete.toLowerCase().trim();
                                                return {
                                                  ...pr,
                                                  commonList: pr.commonList.filter((_, j) => j !== iidx),
                                                  deletedItemsRef: pr.deletedItemsRef.includes(lower) ? pr.deletedItemsRef : [...pr.deletedItemsRef, lower],
                                                  editIndex: pr.editIndex === iidx ? null : pr.editIndex,
                                                  editValue: pr.editIndex === iidx ? '' : pr.editValue,
                                                };
                                              }
                                              return pr;
                                            }));
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add More Safe Food Button */}
              <button
                className="log-reaction-btn"
                style={{ marginBottom: 32, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                onClick={() => setSafeFoodProducts([...safeFoodProducts, {
                  exposureType: '',
                  foodType: '',
                  manualIngredient: '',
                  commonList: [],
                  scanText: '',
                  isScanning: false,
                  scanError: '',
                  isListing: false,
                  listError: '',
                  entryMode: null,
                  editIndex: null,
                  editValue: '',
                  isEditingOrDeleting: false,
                  deletedItemsRef: [],
                  expanded: true,
                  name: '',
                  barcode: '',
                  barcodeError: '',
                  isBarcodeLoading: false,
                  hasProcessedScanText: false,
                }])}
              >
                Add Another Safe Food
              </button>
              
              {/* Navigation */}
              <div className="step-navigation" style={{ marginTop: 32, width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'center', gap: 24 }}>
                <button className="log-reaction-btn secondary" style={{ fontWeight: 700, fontSize: 16, borderRadius: 10, padding: '0.7rem 2.2rem', background: 'linear-gradient(90deg,#e0e7ef,#bae6fd)', color: '#0ea5e9', border: '1.5px solid #38bdf8' }} onClick={() => setSafeFoodStep(0)}>
                  Back to Landing
                </button>
                <button 
                  className="log-reaction-btn" 
                  style={{ background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                  onClick={() => setSafeFoodStep(2)}
                  disabled={!safeFoodTime}
                >
                  Next Step
                </button>
              </div>
            </div>
          ) : safeFoodStep === 2 ? (
            <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h2 className="log-reaction-title" style={{ textAlign: 'center', marginBottom: 4, fontWeight: 800, fontSize: 32, color: '#22c55e', letterSpacing: 0.5 }}>Step 2: Confirmation</h2>
                <p className="log-reaction-desc" style={{ textAlign: 'center', marginBottom: 18, color: '#64748b', fontSize: 18 }}>Review your safe food information before submitting.</p>
              </div>
              
              {/* Safe Food Summary */}
              <div style={{ width: '100%', maxWidth: 700, marginBottom: 32, borderRadius: 22, boxShadow: '0 8px 32px rgba(30,64,175,0.10)', background: 'linear-gradient(135deg, #f0fdf4 0%, #e0e7ef 100%)', padding: '2.2rem 2rem', border: '1.5px solid #22c55e', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', opacity: 0.12, fontSize: 60, textAlign: 'center' }}><Stethoscope size={60} /></div>
                <h3 style={{ color: '#22c55e', fontWeight: 800, fontSize: 22, marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Safe Food Information</h3>
                <div style={{ display: 'grid', gap: 18, justifyItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ fontWeight: 700, color: '#334155', fontSize: 15, letterSpacing: 0.2 }}>Time of Consumption</label>
                    <p style={{ color: '#1e293b', marginTop: 4, fontSize: 16 }}>{safeFoodTime ? new Date(safeFoodTime).toLocaleString() : 'Not specified'}</p>
                  </div>
                </div>
              </div>

              {/* Safe Foods Summary */}
              <div style={{ width: '100%', maxWidth: 700, marginBottom: 32, borderRadius: 22, boxShadow: '0 8px 32px rgba(30,64,175,0.10)', background: 'linear-gradient(135deg, #f0fdf4 0%, #e0e7ef 100%)', padding: '2.2rem 2rem', border: '1.5px solid #22c55e', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', opacity: 0.12, fontSize: 60, textAlign: 'center' }}>✅</div>
                <h3 style={{ color: '#22c55e', fontWeight: 800, fontSize: 22, marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Safe Foods</h3>
                {safeFoodProducts.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center' }}>No safe foods logged</p>
                ) : (
                  <div style={{ display: 'grid', gap: 24, justifyItems: 'center' }}>
                    {safeFoodProducts.map((product, idx) => (
                      <div key={idx} style={{ background: 'linear-gradient(90deg,#fff 0%,#f0fdf4 100%)', borderRadius: 14, padding: 18, border: '1.5px solid #e0e7ef', boxShadow: '0 2px 8px rgba(30,64,175,0.06)', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ fontWeight: 700, color: '#22c55e', marginBottom: 8, fontSize: 18, letterSpacing: 0.2, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                          {product.name || `Safe Food ${idx + 1}`}
                        </h4>
                        {product.exposureType && (
                          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 8, fontWeight: 500, textAlign: 'center' }}>
                            Type: {product.exposureType}
                          </p>
                        )}
                        {product.barcode && (
                          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 8, fontWeight: 500, textAlign: 'center' }}>
                            Barcode: {product.barcode}
                          </p>
                        )}
                        {product.commonList.length > 0 && (
                          <div style={{ marginBottom: 16, width: '100%' }}>
                            <label className="log-reaction-label" style={{ marginBottom: 8 }}>Ingredient List</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, justifyContent: 'center' }}>
                              {product.commonList.map((ingredient, iidx) => (
                                <span key={iidx} style={{ background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#fff', padding: '5px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 1px 4px rgba(34,197,94,0.08)' }}>
                                  {ingredient}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="step-navigation" style={{ marginTop: 32, width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'center', gap: 24 }}>
                <button className="log-reaction-btn secondary" style={{ fontWeight: 700, fontSize: 16, borderRadius: 10, padding: '0.7rem 2.2rem', background: 'linear-gradient(90deg,#e0e7ef,#bae6fd)', color: '#0ea5e9', border: '1.5px solid #38bdf8' }} onClick={() => setSafeFoodStep(1)}>
                  Back to Step 1
                </button>
                <button
                  className="log-reaction-btn"
                  style={{ fontWeight: 800, fontSize: 18, borderRadius: 10, padding: '0.7rem 2.5rem', background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.10)', border: 'none', opacity: isSafeFoodSubmitting ? 0.6 : 1, pointerEvents: isSafeFoodSubmitting ? 'none' : 'auto' }}
                  disabled={isSafeFoodSubmitting}
                  onClick={submitSafeFoodLog}
                >
                  {isSafeFoodSubmitting ? 'Submitting...' : <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: 'middle', marginBottom: 2 }}><polyline points="20 6 9 17 4 12"/></svg>Submit</span>}
                </button>
              </div>
            </div>
          ) : safeFoodStep === 3 ? (
            <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', borderRadius: 28, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', boxShadow: '0 8px 32px rgba(34,197,94,0.13)', border: '2px solid #22c55e', position: 'relative', minHeight: 420 }}>
              <div style={{ marginBottom: 24 }}>
                <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2 style={{ color: '#22c55e', fontWeight: 800, fontSize: 32, marginBottom: 12 }}>Submitted!</h2>
              <p style={{ color: '#64748b', fontSize: 18, marginBottom: 24 }}>Safe food log submission successful!</p>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22, marginTop: 32 }}>
                <button
                  className="log-reaction-btn"
                  style={{ fontWeight: 800, fontSize: 18, borderRadius: 10, padding: '0.7rem 2.5rem', background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.10)', border: 'none', opacity: 1, pointerEvents: 'auto' }}
                  onClick={() => navigate('/dashboard/analysis')}
                >
                  <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: 'middle', marginBottom: 2 }}><polyline points="20 6 9 17 4 12"/></svg>Go to Analysis</span>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>See updated allergen analysis</div>
                </button>
                <button
                  className="log-reaction-btn"
                  style={{ fontWeight: 800, fontSize: 18, borderRadius: 10, padding: '0.7rem 2.5rem', background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.10)', border: 'none', opacity: 1, pointerEvents: 'auto' }}
                  onClick={() => navigate('/dashboard/history')}
                >
                  <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: 'middle', marginBottom: 2 }}><polyline points="20 6 9 17 4 12"/></svg>Go to History</span>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>View your safe food logs</div>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default LogReaction; 