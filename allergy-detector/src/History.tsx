import React, { useEffect, useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import './Dashboard.css';
import { History as HistoryIcon, ClipboardList, BarChart3, CheckCircle, Trash2 } from 'lucide-react';
import { db } from './firebase';
import { collection, query, where, getDocs, deleteDoc, doc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useAccessControl } from './hooks/useAccessControl';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

interface SafeFoodLog {
  time: string;
  products: LogProduct[];
  docId?: string;
}

const History: React.FC = () => {
  const { redirectIfNoAccess } = useAccessControl();
  
  // Check access on component mount
  useEffect(() => {
    redirectIfNoAccess();
  }, [redirectIfNoAccess]);

  const [logs, setLogs] = useState<AllergyLog[]>([]);
  const [safeFoodLogs, setSafeFoodLogs] = useState<SafeFoodLog[]>([]);
  const [activeTab, setActiveTab] = useState<'allergy' | 'safe-food'>('allergy');
  const [loading, setLoading] = useState(true);
  const [displayedLogs, setDisplayedLogs] = useState<AllergyLog[]>([]);
  const [logsToShow, setLogsToShow] = useState(3);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [deletingLogs, setDeletingLogs] = useState<Set<string>>(new Set());
  const [deletedLogs, setDeletedLogs] = useState<Set<string>>(new Set());
  const [deletingSafeFoods, setDeletingSafeFoods] = useState<Set<string>>(new Set());
  const [deletedSafeFoods, setDeletedSafeFoods] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [pdfLoading, setPdfLoading] = useState(false);

  // Create a hash of logs data for comparison
  const createLogsHash = (logsData: AllergyLog[]): string => {
    return logsData.map(log => `${log.time}-${log.docId}`).join('|');
  };

  // Migrate existing logs to current user
  const migrateExistingLogs = async () => {
    if (!user) return;
    
    try {
      console.log('Starting log migration for user:', user.uid);
      
      // Get all logs
      const allLogsQuery = query(collection(db, 'logs'));
      const allLogsSnapshot = await getDocs(allLogsQuery);
      
      console.log('Found', allLogsSnapshot.size, 'total logs to check for migration');
      
      let migratedCount = 0;
      
      for (const doc of allLogsSnapshot.docs) {
        const data = doc.data();
        
        // If this log doesn't belong to current user, create a copy for current user
        if (data.uid !== user.uid) {
          console.log('Migrating log:', doc.id, 'from UID:', data.uid, 'to UID:', user.uid);
          
          // Create new log with current user's UID
          const newLogData = {
            ...data,
            uid: user.uid,
            migratedFrom: doc.id,
            migratedAt: new Date().toISOString()
          };
          
          await addDoc(collection(db, 'logs'), newLogData);
          migratedCount++;
        }
      }
      
      console.log('Migration complete. Migrated', migratedCount, 'logs to user:', user.uid);
      
    } catch (error) {
      console.error('Error during log migration:', error);
    }
  };

  // Save history data to Firebase
  const saveHistoryToFirebase = async (logsData: AllergyLog[], logsHash: string) => {
    if (!user) return;
    
    try {
      const historyRef = doc(db, 'history', user.uid);
      await setDoc(historyRef, {
        logs: logsData,
        logsHash: logsHash,
        lastUpdated: new Date().toISOString(),
        userId: user.uid
      });
      console.log('History saved to Firebase');
    } catch (error) {
      console.error('Error saving history to Firebase:', error);
    }
  };

  // Load history data from Firebase
  const loadHistoryFromFirebase = async (): Promise<{ logs: AllergyLog[]; logsHash: string } | null> => {
    if (!user) return null;
    
    try {
      const historyRef = doc(db, 'history', user.uid);
      const historyDoc = await getDoc(historyRef);
      
      if (historyDoc.exists()) {
        const data = historyDoc.data();
        console.log('History loaded from Firebase');
        return {
          logs: data.logs,
          logsHash: data.logsHash
        };
      }
    } catch (error) {
      console.error('Error loading history from Firebase:', error);
    }
    
    return null;
  };

    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Always fetch from live logs collection first
      const q = query(collection(db, 'logs'), where('uid', '==', user?.uid));
        const querySnapshot = await getDocs(q);
        console.log('History: Found', querySnapshot.size, 'logs in Firebase');
        
        const logsData: AllergyLog[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          console.log('History: Processing log:', doc.id, 'UID:', data.uid, 'Time:', data.time, 'Products:', data.products?.length || 0);
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
        
        console.log('History: Final logs data:', logsData);
        console.log('History: Logs data length:', logsData.length);
        setLogs(logsData);
        setDisplayedLogs(logsData.slice(0, logsToShow));
        setHasMoreLogs(logsData.length > logsToShow);
        // Update the history cache
        const newLogsHash = createLogsHash(logsData);
        await saveHistoryToFirebase(logsData, newLogsHash);
        setLoading(false);
      } catch (err) {
        // If live fetch fails, fallback to cache
        const savedHistory = await loadHistoryFromFirebase();
        if (savedHistory) {
          setLogs(savedHistory.logs);
          setDisplayedLogs(savedHistory.logs.slice(0, logsToShow));
          setHasMoreLogs(savedHistory.logs.length > logsToShow);
        }
        setLoading(false);
      }
    };

  // Fetch safe food logs
  const fetchSafeFoodLogs = async () => {
    try {
      const q = query(collection(db, 'safe_foods'), where('uid', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      console.log('History: Found', querySnapshot.size, 'safe food logs in Firebase');
      
      const safeFoodLogsData: SafeFoodLog[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        safeFoodLogsData.push({
          time: data.time,
          products: data.products || [],
          docId: doc.id,
        });
      });
      // Sort by time descending (latest first)
      safeFoodLogsData.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setSafeFoodLogs(safeFoodLogsData);
    } catch (err) {
      console.error('Error fetching safe food logs:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      console.log('No user found in History component');
      return;
    }
    console.log('User found in History:', user.uid, user.email);
    fetchLogs();
    fetchSafeFoodLogs();
  }, [user]);

  useEffect(() => {
    setDisplayedLogs(logs.slice(0, logsToShow));
    setHasMoreLogs(logs.length > logsToShow);
  }, [logs, logsToShow]);

  // Clear success notification after 3 seconds
  useEffect(() => {
    if (deletedLogs.size > 0) {
      const timer = setTimeout(() => {
        setDeletedLogs(new Set());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deletedLogs]);

  // Clear safe food success notification after 3 seconds
  useEffect(() => {
    if (deletedSafeFoods.size > 0) {
      const timer = setTimeout(() => {
        setDeletedSafeFoods(new Set());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deletedSafeFoods]);

  const handleShowMore = () => {
    setLogsToShow(prev => prev + 3);
  };

  const toggleCardExpansion = (cardIndex: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardIndex)) {
        newSet.delete(cardIndex);
      } else {
        newSet.add(cardIndex);
      }
      return newSet;
    });
  };

  const handleDelete = async (docId: string) => {
    if (!docId) return;
    
    if (!window.confirm('Are you sure you want to delete this log? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingLogs(prev => new Set(prev).add(docId));
      
      // Fetch the log document before deleting
      const logRef = doc(db, 'logs', docId);
      const logSnap = await getDoc(logRef);
      
      if (!logSnap.exists()) {
        alert('Log not found in Firestore.');
        setDeletingLogs(prev => { const newSet = new Set(prev); newSet.delete(docId); return newSet; });
        return;
      }
      
      const logData = logSnap.data();
      
      if (logData.uid !== user?.uid) {
        alert('You do not have permission to delete this log. Log UID: ' + logData.uid + ', Your UID: ' + user?.uid);
        setDeletingLogs(prev => { const newSet = new Set(prev); newSet.delete(docId); return newSet; });
        return;
      }
      
      // Remove from UI immediately for better UX
      const updatedLogs = logs.filter(log => log.docId !== docId);
      setLogs(updatedLogs);
      setDisplayedLogs(updatedLogs.filter(log => log.docId !== docId));
      
      // Delete from Firestore
      await deleteDoc(logRef);
      
      // Refetch logs from Firestore to ensure UI is in sync
      const q = query(collection(db, 'logs'), where('uid', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      
      const freshLogs: AllergyLog[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        freshLogs.push({
          time: data.time,
          severity: data.severity,
          symptoms: data.symptoms || [],
          symptomDesc: data.symptomDesc || '',
          aiAnalysis: data.aiAnalysis || '',
          products: data.products || [],
          environmentalCause: data.environmentalCause || '',
          docId: docSnap.id,
        });
      });
      
      setLogs(freshLogs);
      setDisplayedLogs(freshLogs.slice(0, logsToShow));
      setHasMoreLogs(freshLogs.length > logsToShow);
      
      // Note: Removed history cache update to avoid permission issues
      // The delete operation works fine without updating the cache
      
      setDeletedLogs(prev => new Set(prev).add(docId));
      
    } catch (err) {
      console.error('Error deleting log:', err);
      alert('Failed to delete log. Please try again. Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDeletingLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const handleDeleteSafeFood = async (docId: string) => {
    if (!docId) return;
    
    if (!window.confirm('Are you sure you want to delete this safe food log? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingSafeFoods(prev => new Set(prev).add(docId));
      
      // Fetch the safe food document before deleting
      const safeFoodRef = doc(db, 'safe_foods', docId);
      const safeFoodSnap = await getDoc(safeFoodRef);
      
      if (!safeFoodSnap.exists()) {
        alert('Safe food log not found in Firestore.');
        setDeletingSafeFoods(prev => { const newSet = new Set(prev); newSet.delete(docId); return newSet; });
        return;
      }
      
      const safeFoodData = safeFoodSnap.data();
      
      if (safeFoodData.uid !== user?.uid) {
        alert('You do not have permission to delete this safe food log. Log UID: ' + safeFoodData.uid + ', Your UID: ' + user?.uid);
        setDeletingSafeFoods(prev => { const newSet = new Set(prev); newSet.delete(docId); return newSet; });
        return;
      }
      
      // Remove from UI immediately for better UX
      const updatedSafeFoodLogs = safeFoodLogs.filter(log => log.docId !== docId);
      setSafeFoodLogs(updatedSafeFoodLogs);
      
      // Delete from Firestore
      await deleteDoc(safeFoodRef);
      
      // Refetch safe food logs from Firestore to ensure UI is in sync
      const q = query(collection(db, 'safe_foods'), where('uid', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      
      const freshSafeFoodLogs: SafeFoodLog[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        freshSafeFoodLogs.push({
          time: data.time,
          products: data.products || [],
          docId: docSnap.id,
        });
      });
      
      setSafeFoodLogs(freshSafeFoodLogs);
      
      setDeletedSafeFoods(prev => new Set(prev).add(docId));
      
    } catch (err) {
      console.error('Error deleting safe food log:', err);
      alert('Failed to delete safe food log. Please try again. Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDeletingSafeFoods(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  // PDF generation handler
  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      console.log('Starting PDF generation...');
      // Fetch analysis data from Firestore
      let overallSummary = '';
      let testKitSuggestions = '';
      let riskLevels: Record<string, number> = {};
      let localAllergens: Array<{
        ingredient: string;
        frequency: number;
        averageSeverity: number;
        symptoms: string[];
        environmentalNotes: string[];
        riskLevel: number;
      }> = [];
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      console.log('Fetching analysis data for user:', user.uid);
      
      // Overall summary
      try {
        const summaryRef = doc(db, 'overall_summary', user.uid);
        const summaryDoc = await getDoc(summaryRef);
        overallSummary = summaryDoc.exists() ? summaryDoc.data().summary || '' : '';
        console.log('Overall summary loaded:', overallSummary ? 'Yes' : 'No');
      } catch (error) {
        console.error('Error loading overall summary:', error);
      }
      
      // Test kit suggestions
      try {
        const testKitRef = doc(db, 'test_kit_suggestions', user.uid);
        const testKitDoc = await getDoc(testKitRef);
        testKitSuggestions = testKitDoc.exists() ? testKitDoc.data().suggestions || '' : '';
        console.log('Test kit suggestions loaded:', testKitSuggestions ? 'Yes' : 'No');
      } catch (error) {
        console.error('Error loading test kit suggestions:', error);
      }
      
      // Risk levels
      try {
        const riskRef = doc(db, 'risk_levels', user.uid);
        const riskDoc = await getDoc(riskRef);
        riskLevels = riskDoc.exists() ? riskDoc.data().levels || {} : {};
        console.log('Risk levels loaded:', Object.keys(riskLevels).length);
      } catch (error) {
        console.error('Error loading risk levels:', error);
      }
      
      // Allergen ranking (localAllergens)
      console.log('Processing allergen data from logs:', logs.length);
      const safeFoodIngredients = new Set<string>();
      safeFoodLogs.forEach(log => {
        (log.products || []).forEach(product => {
          (product.commonList || []).forEach(ingredient => {
            safeFoodIngredients.add(ingredient.trim().toLowerCase());
          });
        });
      });
      
      const allergenMap: Record<string, {
        count: number;
        totalSeverity: number;
        symptoms: Set<string>;
        env: Set<string>;
      }> = {};
      
      logs.forEach(log => {
        (log.products || []).forEach(product => {
          (product.commonList || []).forEach(ingredient => {
            const key = ingredient.trim().toLowerCase();
            if (!allergenMap[key]) {
              allergenMap[key] = { count: 0, totalSeverity: 0, symptoms: new Set(), env: new Set() };
            }
            allergenMap[key].count += 1;
            allergenMap[key].totalSeverity += log.severity || 0;
            (log.symptoms || []).forEach(s => allergenMap[key].symptoms.add(s));
            if (log.environmentalCause) allergenMap[key].env.add(log.environmentalCause);
          });
        });
      });
      
      localAllergens = Object.entries(allergenMap)
        .map(([ingredient, data]) => ({
          ingredient,
          frequency: data.count,
          averageSeverity: data.count ? data.totalSeverity / data.count : 0,
          symptoms: Array.from(data.symptoms),
          environmentalNotes: Array.from(data.env),
          riskLevel: riskLevels[ingredient] || 50,
        }))
        .filter(allergen => !safeFoodIngredients.has(allergen.ingredient.toLowerCase()))
        .sort((a, b) => b.frequency - a.frequency);
      
      console.log('Local allergens processed:', localAllergens.length);
      
      // Start PDF generation
      console.log('Creating PDF document...');
      const pdfDoc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdfDoc.internal.pageSize.getWidth();
      const margin = 40;
      let y = 60;
      
      // Title
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(26);
      pdfDoc.text('Allergy Analysis & History Report', margin, y);
      y += 36;
      
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(13);
      pdfDoc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 28;
      
      // Section: Overall Summary
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(18);
      pdfDoc.text('Overall AI Summary', margin, y);
      y += 22;
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(12);
      const summaryLines = pdfDoc.splitTextToSize(overallSummary || 'No summary available.', pageWidth - margin * 2);
      let summaryHeight = summaryLines.length * 15 + 18;
      if (y + summaryHeight + 30 > 760) { pdfDoc.addPage(); y = 60; }
      pdfDoc.text(summaryLines, margin, y);
      y += summaryHeight;
      
      // Section: Allergen Ranking
      pdfDoc.setDrawColor(200, 200, 200);
      pdfDoc.setLineWidth(1);
      pdfDoc.line(margin, y, pageWidth - margin, y);
      y += 18;
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(16);
      pdfDoc.text('Most Likely Allergens', margin, y);
      y += 18;
      if (localAllergens.length === 0) {
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(12);
        pdfDoc.text('No allergen data available.', margin, y);
        y += 18;
      } else {
        localAllergens.slice(0, 10).forEach((allergen, idx) => {
          // Calculate card height
          const symptomsLines = pdfDoc.splitTextToSize(`Symptoms: ${allergen.symptoms.length > 0 ? allergen.symptoms.join(', ') : 'None'}`, pageWidth - margin * 2 - 16);
          let cardHeight = 54 + symptomsLines.length * 16;
          let envLines: string[] = [];
          if (allergen.environmentalNotes.length > 0) {
            envLines = pdfDoc.splitTextToSize(`Environmental: ${allergen.environmentalNotes.join(', ')}`, pageWidth - margin * 2 - 16);
            cardHeight += envLines.length * 16;
          }
          cardHeight += 36; // extra padding for style
          // If not enough space, add a new page
          if (y + cardHeight + 30 > 760) { pdfDoc.addPage(); y = 60; }
          // Allergen Card Background
          pdfDoc.setFillColor(240, 249, 255);
          pdfDoc.roundedRect(margin - 4, y - 16, pageWidth - margin * 2 + 8, cardHeight, 12, 12, 'F');
          // Allergen Name and Index
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(15);
          pdfDoc.text(`${idx + 1}. ${allergen.ingredient.charAt(0).toUpperCase() + allergen.ingredient.slice(1)}`, margin + 12, y + 12);
          // Risk Badge
          let riskR = 100, riskG = 116, riskB = 139;
          let riskText = 'Very Low';
          if (allergen.riskLevel >= 80) { riskR = 220; riskG = 38; riskB = 38; riskText = 'Very High'; }
          else if (allergen.riskLevel >= 60) { riskR = 234; riskG = 88; riskB = 12; riskText = 'High'; }
          else if (allergen.riskLevel >= 40) { riskR = 217; riskG = 119; riskB = 6; riskText = 'Moderate'; }
          else if (allergen.riskLevel >= 20) { riskR = 22; riskG = 163; riskB = 74; riskText = 'Low'; }
          pdfDoc.setFillColor(riskR, riskG, riskB);
          pdfDoc.roundedRect(pageWidth - margin - 100, y - 2, 90, 28, 10, 10, 'F');
          pdfDoc.setTextColor(255, 255, 255);
          pdfDoc.setFontSize(13);
          pdfDoc.text(riskText, pageWidth - margin - 55, y + 15, { align: 'center' });
          pdfDoc.setTextColor(30, 41, 59);
          // Frequency & Severity
          pdfDoc.setFont('helvetica', 'normal');
          pdfDoc.setFontSize(13);
          pdfDoc.text(`Frequency: ${allergen.frequency}   Avg Severity: ${allergen.averageSeverity.toFixed(1)}`, margin + 12, y + 32);
          // Symptoms
          pdfDoc.setFontSize(12);
          pdfDoc.text(symptomsLines, margin + 12, y + 52);
          let blockY = y + 52 + symptomsLines.length * 16;
          // Environmental
          if (envLines.length > 0) {
            pdfDoc.text(envLines, margin + 12, blockY);
            blockY += envLines.length * 16;
          }
          y += cardHeight + 18;
        });
      }
      y += 18;
      // Section: Test Kit Suggestions
      pdfDoc.setDrawColor(200, 200, 200);
      pdfDoc.setLineWidth(1);
      pdfDoc.line(margin, y, pageWidth - margin, y);
      y += 24;
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(17);
      pdfDoc.text('Recommended Test Kits', margin, y);
      y += 20;
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(13);
      if (testKitSuggestions) {
        const kitLines = testKitSuggestions.split('\n').filter(line => line.trim());
        let allKitWrappedLines: string[] = [];
        kitLines.forEach(line => {
          const wrapped = pdfDoc.splitTextToSize(line, pageWidth - margin * 2 - 8);
          allKitWrappedLines.push(...wrapped);
        });
        const kitHeight = allKitWrappedLines.length * 18;
        if (y + kitHeight + 30 > 760) { pdfDoc.addPage(); y = 60; }
        allKitWrappedLines.forEach(wrappedLine => {
          pdfDoc.text(wrappedLine, margin + 12, y);
          y += 18;
        });
      } else {
        pdfDoc.text('No test kit suggestions available.', margin + 12, y);
        y += 18;
      }
      y += 24;
      // Section: Allergy Logs
      pdfDoc.setDrawColor(200, 200, 200);
      pdfDoc.setLineWidth(1);
      pdfDoc.line(margin, y, pageWidth - margin, y);
      y += 24;
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(17);
      pdfDoc.text('Allergy Logs', margin, y);
      y += 20;
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(13);
      if (logs.length === 0) {
        pdfDoc.text('No allergy logs found.', margin + 12, y);
        y += 18;
      } else {
        logs.forEach((log, idx) => {
          // Calculate log card height
          const symptomsLines = pdfDoc.splitTextToSize(`Symptoms: ${log.symptoms.join(', ') || 'None'}`, pageWidth - margin * 2 - 16);
          let logHeight = 26 + symptomsLines.length * 16;
          let descLines: string[] = [];
          let aiLines: string[] = [];
          let envLines: string[] = [];
          let prodLinesArr: string[][] = [];
          let ingLinesArr: string[][] = [];
          if (log.symptomDesc) {
            descLines = pdfDoc.splitTextToSize(`Symptom Description: ${log.symptomDesc}`, pageWidth - margin * 2 - 16);
            logHeight += descLines.length * 16;
          }
          if (log.aiAnalysis) {
            aiLines = pdfDoc.splitTextToSize(`AI Analysis: ${log.aiAnalysis}`, pageWidth - margin * 2 - 16);
            logHeight += aiLines.length * 16;
          }
          if (log.environmentalCause) {
            envLines = pdfDoc.splitTextToSize(`Environmental Cause: ${log.environmentalCause}`, pageWidth - margin * 2 - 16);
            logHeight += envLines.length * 16;
          }
          if (log.products && log.products.length > 0) {
            log.products.forEach((product, pidx) => {
              const prodLines = pdfDoc.splitTextToSize(`Product: ${product.name || `Product ${pidx + 1}`}`, pageWidth - margin * 2 - 16);
              prodLinesArr.push(prodLines);
              logHeight += prodLines.length * 16;
              if (product.exposureType) {
                logHeight += 16;
              }
              if (product.barcode) {
                logHeight += 16;
              }
              if (product.commonList && product.commonList.length > 0) {
                const ingLines = pdfDoc.splitTextToSize(`Ingredients: ${product.commonList.join(', ')}`, pageWidth - margin * 2 - 40);
                ingLinesArr.push(ingLines);
                logHeight += ingLines.length * 16;
              }
            });
          }
          logHeight += 36; // extra padding for style
          // If not enough space, add a new page
          if (y + logHeight + 30 > 760) { pdfDoc.addPage(); y = 60; }
          pdfDoc.setFillColor(248, 250, 252);
          pdfDoc.roundedRect(margin - 2, y - 16, pageWidth - margin * 2 + 4, logHeight, 10, 10, 'F');
          // Log header: Log # (left), Time (middle), Severity (right) all on one line
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(14);
          const logNumText = `Log #${logs.length - idx}`;
          const timeText = `Time: ${new Date(log.time).toLocaleString()}`;
          const severityText = `Severity: ${log.severity}/10`;
          const logNumWidth = pdfDoc.getTextWidth(logNumText);
          const timeWidth = pdfDoc.getTextWidth(timeText);
          const severityWidth = pdfDoc.getTextWidth(severityText);
          const headerY = y + 12;
          const gap = 18;
          const rightEdge = pageWidth - margin - 12;
          // Log # at left
          pdfDoc.text(logNumText, margin + 12, headerY);
          // Severity at right
          pdfDoc.text(severityText, rightEdge - severityWidth, headerY);
          // Time after Log #, but before Severity
          let timeX = margin + 12 + logNumWidth + gap;
          // If not enough space, reduce gap
          if (timeX + timeWidth + gap > rightEdge - severityWidth) {
            timeX = rightEdge - severityWidth - timeWidth - gap;
            if (timeX < margin + 12 + logNumWidth + 2) {
              timeX = margin + 12 + logNumWidth + 2; // fallback, minimal gap
            }
          }
          pdfDoc.text(timeText, timeX, headerY);
          pdfDoc.setFont('helvetica', 'normal');
          pdfDoc.setFontSize(13);
          let blockY = y + 32;
          pdfDoc.setFontSize(12);
          pdfDoc.text(symptomsLines, margin + 12, blockY);
          blockY += symptomsLines.length * 16;
          if (descLines.length > 0) {
            pdfDoc.text(descLines, margin + 12, blockY);
            blockY += descLines.length * 16;
          }
          if (aiLines.length > 0) {
            pdfDoc.text(aiLines, margin + 12, blockY);
            blockY += aiLines.length * 16;
          }
          if (envLines.length > 0) {
            pdfDoc.text(envLines, margin + 12, blockY);
            blockY += envLines.length * 16;
          }
          if (log.products && log.products.length > 0) {
            log.products.forEach((product, pidx) => {
              const prodLines = prodLinesArr[pidx];
              pdfDoc.text(prodLines, margin + 32, blockY);
              blockY += prodLines.length * 16;
              if (product.exposureType) {
                pdfDoc.text(`Type: ${product.exposureType}`, margin + 48, blockY);
                blockY += 16;
              }
              if (product.barcode) {
                pdfDoc.text(`Barcode: ${product.barcode}`, margin + 48, blockY);
                blockY += 16;
              }
              if (product.commonList && product.commonList.length > 0) {
                const ingLines = ingLinesArr[pidx];
                pdfDoc.text(ingLines, margin + 48, blockY);
                blockY += ingLines.length * 16;
              }
            });
          }
          y += logHeight + 24;
        });
      }
      y += 24;
      // Section: Safe Food Logs
      pdfDoc.setDrawColor(200, 200, 200);
      pdfDoc.setLineWidth(1);
      pdfDoc.line(margin, y, pageWidth - margin, y);
      y += 24;
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(17);
      pdfDoc.text('Safe Food Logs', margin, y);
      y += 20;
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(13);
      if (safeFoodLogs.length === 0) {
        pdfDoc.text('No safe food logs found.', margin + 12, y);
        y += 18;
      } else {
        safeFoodLogs.forEach((log, idx) => {
          // Calculate log card height
          let logHeight = 26;
          let prodLinesArr: string[][] = [];
          let ingLinesArr: string[][] = [];
          if (log.products && log.products.length > 0) {
            log.products.forEach((product, pidx) => {
              const prodLines = pdfDoc.splitTextToSize(`Product: ${product.name || `Safe Food ${pidx + 1}`}`, pageWidth - margin * 2 - 16);
              prodLinesArr.push(prodLines);
              logHeight += prodLines.length * 16;
              if (product.exposureType) {
                logHeight += 16;
              }
              if (product.barcode) {
                logHeight += 16;
              }
              if (product.commonList && product.commonList.length > 0) {
                const ingLines = pdfDoc.splitTextToSize(`Safe Ingredients: ${product.commonList.join(', ')}`, pageWidth - margin * 2 - 40);
                ingLinesArr.push(ingLines);
                logHeight += ingLines.length * 16;
              }
            });
          }
          logHeight += 28; // extra padding for style
          // If not enough space, add a new page
          if (y + logHeight + 30 > 760) { pdfDoc.addPage(); y = 60; }
          pdfDoc.setFillColor(236, 253, 245);
          pdfDoc.roundedRect(margin - 2, y - 16, pageWidth - margin * 2 + 4, logHeight, 10, 10, 'F');
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(14);
          pdfDoc.text(`Safe Food #${safeFoodLogs.length - idx}`, margin + 12, y + 12);
          pdfDoc.setFont('helvetica', 'normal');
          pdfDoc.setFontSize(13);
          pdfDoc.text(`Time: ${new Date(log.time).toLocaleString()}`, margin + 140, y + 12);
          let blockY = y + 32;
          if (log.products && log.products.length > 0) {
            log.products.forEach((product, pidx) => {
              const prodLines = prodLinesArr[pidx];
              pdfDoc.text(prodLines, margin + 32, blockY);
              blockY += prodLines.length * 16;
              if (product.exposureType) {
                pdfDoc.text(`Type: ${product.exposureType}`, margin + 48, blockY);
                blockY += 16;
              }
              if (product.barcode) {
                pdfDoc.text(`Barcode: ${product.barcode}`, margin + 48, blockY);
                blockY += 16;
              }
              if (product.commonList && product.commonList.length > 0) {
                const ingLines = ingLinesArr[pidx];
                pdfDoc.text(ingLines, margin + 48, blockY);
                blockY += ingLines.length * 16;
              }
            });
          }
          y += logHeight + 18;
        });
      }
      pdfDoc.save('allergy_report.pdf');
      console.log('PDF saved successfully');
      
    } catch (err) {
      console.error('PDF generation error:', err);
      alert(`Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
          }
        `}
      </style>
      <DashboardSidebar />
      <main className="dashboard-main">
        <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Success Notification */}
          {(deletedLogs.size > 0 || deletedSafeFoods.size > 0) && (
            <div style={{
              position: 'fixed',
              top: 20,
              right: 20,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
              zIndex: 1000,
              animation: 'fadeInOut 3s ease-in-out',
              fontWeight: 600,
              fontSize: 14
            }}>
              {deletedLogs.size > 0 && deletedSafeFoods.size > 0 
                ? 'Logs deleted successfully!' 
                : deletedLogs.size > 0 
                  ? 'Allergy log deleted successfully!' 
                  : 'Safe food log deleted successfully!'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, marginTop: 24 }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              borderRadius: '50%',
              width: 60,
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(56,189,248,0.10)',
              marginBottom: 12
            }}>
              <HistoryIcon size={36} color="#fff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
              <h2 style={{ fontWeight: 800, fontSize: 30, color: '#0ea5e9', letterSpacing: 0.5, textAlign: 'center', margin: 0 }}>History</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: 18, textAlign: 'center' }}>View and manage your allergy reaction documentation.</p>
            <button
              onClick={handleDownloadPDF}
              style={{
                marginTop: 12,
                background: 'linear-gradient(90deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '0.85rem 2.1rem',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
                fontFamily: 'Segoe UI, Arial, sans-serif',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.10)',
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Download PDF Report
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 32,
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setActiveTab('allergy')}
              style={{
                background: activeTab === 'allergy' 
                  ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' 
                  : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                color: activeTab === 'allergy' ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'allergy' ? '0 4px 16px rgba(14, 165, 233, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              Allergy Logs
            </button>
            <button
              onClick={() => setActiveTab('safe-food')}
              style={{
                background: activeTab === 'safe-food' 
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
                  : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                color: activeTab === 'safe-food' ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'safe-food' ? '0 4px 16px rgba(34, 197, 94, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              Safe Foods
            </button>
          </div>
          
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
              <div style={{
                background: 'linear-gradient(135deg, #e0e7ef 0%, #bae6fd 100%)',
                borderRadius: '50%',
                width: 70,
                height: 70,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(56,189,248,0.10)',
                marginBottom: 18
              }}>
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="19" cy="19" r="16" stroke="#38bdf8" strokeWidth="4" opacity="0.2" />
                  <path d="M35 19c0-8.837-7.163-16-16-16" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 19 19" to="360 19 19" dur="1s" repeatCount="indefinite" />
                  </path>
                </svg>
              </div>
              <h3 style={{ color: '#64748b', fontWeight: 600, fontSize: 22, marginBottom: 8 }}>Loading logs...</h3>
            </div>
          ) : activeTab === 'allergy' ? (
            logs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
              <div style={{
                background: 'linear-gradient(135deg, #e0e7ef 0%, #bae6fd 100%)',
                borderRadius: '50%',
                width: 70,
                height: 70,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(56,189,248,0.10)',
                marginBottom: 18
              }}>
                  <ClipboardList size={38} color="#38bdf8" />
              </div>
                <h3 style={{ color: '#64748b', fontWeight: 600, fontSize: 22, marginBottom: 8 }}>No allergy logs found</h3>
              <p style={{ color: '#94a3b8', fontSize: 16 }}>You haven't submitted any allergy logs yet.</p>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 48, alignItems: 'center' }}>
              {displayedLogs.map((log, idx) => {
                const isExpanded = expandedCards.has(idx);
                const isDeleting = deletingLogs.has(log.docId || '');
                return (
                <div key={idx} style={{ 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #f0f9ff 100%)', 
                  borderRadius: 24, 
                  boxShadow: '0 20px 60px rgba(14, 165, 233, 0.15), 0 8px 32px rgba(0, 0, 0, 0.08)', 
                  border: '2px solid rgba(56, 189, 248, 0.2)', 
                  padding: '2.5rem 2rem', 
                  width: '100%', 
                  maxWidth: 750, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  position: 'relative',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  opacity: isDeleting ? 0.6 : 1,
                  transform: isDeleting ? 'scale(0.98)' : 'scale(1)',
                  pointerEvents: isDeleting ? 'none' : 'auto'
                }}>
                  <div style={{ 
                    position: 'absolute', 
                    top: 20, 
                    right: 28, 
                    opacity: 0.08, 
                    fontSize: 52,
                    color: '#0ea5e9'
                  }}>
                      <CheckCircle size={24} />
                  </div>
                  
                  {/* Delete Button */}
                  <div style={{ 
                    position: 'absolute', 
                    top: 20, 
                    left: 28
                  }}>
                    <button
                      onClick={() => log.docId && handleDelete(log.docId)}
                      disabled={deletingLogs.has(log.docId || '')}
                      style={{
                        background: deletingLogs.has(log.docId || '') 
                          ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: deletingLogs.has(log.docId || '') ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
                        transition: 'all 0.3s ease',
                        opacity: deletingLogs.has(log.docId || '') ? 0.6 : 1
                      }}
                      onMouseOver={(e) => {
                        if (!deletingLogs.has(log.docId || '')) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.35)';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.25)';
                      }}
                      title="Delete this log"
                    >
                      {deletingLogs.has(log.docId || '') ? (
                        <div style={{
                          width: 16,
                          height: 16,
                          border: '2px solid #fff',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : (
                          <Trash2 size={20} />
                      )}
                    </button>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 14, 
                    marginBottom: 28,
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    padding: '12px 24px',
                    borderRadius: 50,
                    boxShadow: '0 8px 24px rgba(14, 165, 233, 0.25)'
                  }}>
                      <BarChart3 size={24} color="#fff" />
                    <span style={{ fontWeight: 800, color: '#fff', fontSize: 16, letterSpacing: 0.5 }}>Log #{logs.length - idx}</span>
                  </div>
                  
                  {/* Reaction Details Section */}
                  <div style={{ width: '100%', marginBottom: 32 }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      borderRadius: 16,
                      padding: '16px 24px',
                      marginBottom: 24,
                      boxShadow: '0 8px 24px rgba(14, 165, 233, 0.2)'
                    }}>
                        <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>🩺 Reaction Details</h3>
                    </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                      <div style={{
                          background: 'linear-gradient(135deg, #fff 0%, #f0fdf4 100%)',
                        borderRadius: 16,
                        padding: '20px 24px',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                      }}>
                          <label style={{ fontWeight: 700, color: '#334155', fontSize: 14, letterSpacing: 0.2, marginBottom: 8, display: 'block' }}>Time of Reaction</label>
                          <p style={{ color: '#1e293b', margin: 0, fontSize: 16, fontWeight: 600 }}>{new Date(log.time).toLocaleString()}</p>
                      </div>
                      <div style={{
                          background: 'linear-gradient(135deg, #fff 0%, #fef3c7 100%)',
                        borderRadius: 16,
                        padding: '20px 24px',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                      }}>
                          <label style={{ fontWeight: 700, color: '#334155', fontSize: 14, letterSpacing: 0.2, marginBottom: 8, display: 'block' }}>Severity Grading</label>
                          <p style={{ color: '#1e293b', margin: 0, fontSize: 16, fontWeight: 600 }}>{log.severity}/10</p>
                          </div>
                      <div style={{
                          background: 'linear-gradient(135deg, #fff 0%, #fef3c7 100%)',
                        borderRadius: 16,
                        padding: '20px 24px',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                      }}>
                          <label style={{ fontWeight: 700, color: '#334155', fontSize: 14, letterSpacing: 0.2, marginBottom: 8, display: 'block' }}>Symptoms</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {log.symptoms.map((symptom, sidx) => (
                              <span key={sidx} style={{ 
                                background: 'linear-gradient(90deg,#f59e0b 0%,#d97706 100%)', 
                              color: '#fff',
                                padding: '4px 12px', 
                              borderRadius: 12,
                                fontSize: 12, 
                              fontWeight: 600,
                                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.10)' 
                            }}>
                              {symptom}
                              </span>
                          ))}
                          </div>
                        </div>
                        </div>
                      </div>
                      
                    {/* Symptom Description Section - Only show when expanded */}
                    {isExpanded && log.symptomDesc && (
                      <div style={{ width: '100%', marginBottom: 32 }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          borderRadius: 16,
                          padding: '16px 24px',
                          marginBottom: 24,
                          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)'
                        }}>
                          <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>Symptom Description</h3>
                        </div>
                        <div style={{
                          background: 'linear-gradient(135deg, #fff 0%, #fef3c7 100%)',
                          borderRadius: 16,
                          padding: '20px 24px',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                        }}>
                          <p style={{ color: '#1e293b', fontSize: 15, margin: 0, lineHeight: 1.6 }}>{log.symptomDesc}</p>
                        </div>
                        </div>
                      )}
                    
                    {/* AI Analysis Section - Only show when expanded */}
                    {isExpanded && log.aiAnalysis && (
                      <div style={{ width: '100%', marginBottom: 32 }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          borderRadius: 16,
                          padding: '16px 24px',
                          marginBottom: 24,
                          boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)'
                        }}>
                          <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>🤖 AI Analysis</h3>
                    </div>
                        <div style={{
                          background: 'linear-gradient(135deg, #fff 0%, #f3f4f6 100%)',
                          borderRadius: 16,
                          padding: '20px 24px',
                          border: '1px solid rgba(139, 92, 246, 0.15)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                        }}>
                          <p style={{ color: '#1e293b', fontSize: 15, margin: 0, lineHeight: 1.6 }}>{log.aiAnalysis}</p>
                  </div>
                      </div>
                    )}
                  
                  {/* Environmental Cause Section - Only show when expanded */}
                  {isExpanded && log.environmentalCause && (
                    <div style={{ width: '100%', marginBottom: 32 }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        borderRadius: 16,
                        padding: '16px 24px',
                        marginBottom: 24,
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.2)'
                      }}>
                        <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>Environmental Cause</h3>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #fff 0%, #f0fdf4 100%)',
                        borderRadius: 16,
                        padding: '20px 24px',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                      }}>
                        <p style={{ color: '#1e293b', fontSize: 15, margin: 0, lineHeight: 1.6 }}>{log.environmentalCause}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Exposure Information Section - Only show when expanded */}
                  {isExpanded && (
                    <div style={{ width: '100%' }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        borderRadius: 16,
                        padding: '16px 24px',
                        marginBottom: 24,
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)'
                      }}>
                        <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>🍽️ Exposure Information</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {log.products.map((product, pidx) => (
                          <div key={pidx} style={{ 
                            background: 'linear-gradient(135deg, #fff 0%, #fef3c7 50%, #fefce8 100%)', 
                            borderRadius: 20, 
                            padding: '24px 28px', 
                            border: '2px solid rgba(245, 158, 11, 0.2)', 
                            boxShadow: '0 12px 32px rgba(245, 158, 11, 0.15), 0 4px 16px rgba(0, 0, 0, 0.05)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: 16,
                            textAlign: 'center'
                          }}>
                            <div style={{ 
                              fontWeight: 800, 
                              fontSize: 18,
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: '#fff',
                              padding: '8px 20px',
                              borderRadius: 50,
                              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)'
                            }}>
                              {product.name || `Product ${pidx + 1}`}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                              {product.exposureType && (
                                <div style={{ 
                                  color: '#92400e', 
                                  fontSize: 14, 
                                  fontWeight: 600,
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  padding: '4px 12px',
                                  borderRadius: 8
                                }}>
                                  Type: {product.exposureType}
                                </div>
                              )}
                              {product.barcode && (
                                <div style={{ 
                                  color: '#92400e', 
                                  fontSize: 14, 
                                  fontWeight: 600,
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  padding: '4px 12px',
                                  borderRadius: 8
                                }}>
                                  Barcode: {product.barcode}
                                </div>
                              )}
                            </div>
                            
                            {product.commonList.length > 0 && (
                              <div style={{ width: '100%', textAlign: 'center' }}>
                                <label style={{ 
                                  fontWeight: 700, 
                                  color: '#d97706', 
                                  fontSize: 14, 
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  marginBottom: 12, 
                                  display: 'block' 
                                }}>
                                  Ingredients
                                </label>
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: 6,
                                  alignItems: 'center'
                                }}>
                                  {product.commonList.map((ingredient, iidx) => (
                                    <span key={iidx} style={{ 
                                      color: '#92400e', 
                                      fontSize: 14,
                                      fontWeight: 500,
                                      background: 'rgba(245, 158, 11, 0.1)',
                                      padding: '6px 16px',
                                      borderRadius: 12,
                                      border: '1px solid rgba(245, 158, 11, 0.2)'
                                    }}>
                                      {ingredient}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Show More/Less Button */}
                  <div style={{ marginTop: 24, width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <button 
                      onClick={() => toggleCardExpansion(idx)}
                      style={{
                        background: isExpanded 
                          ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                          : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        color: '#fff',
                        padding: '12px 24px',
                        borderRadius: 50,
                        fontWeight: 600,
                        fontSize: 14,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: isExpanded 
                          ? '0 4px 16px rgba(100, 116, 139, 0.25)'
                          : '0 4px 16px rgba(14, 165, 233, 0.25)',
                        transition: 'all 0.3s ease',
                        letterSpacing: 0.5
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = isExpanded 
                          ? '0 8px 24px rgba(100, 116, 139, 0.35)'
                          : '0 8px 24px rgba(14, 165, 233, 0.35)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = isExpanded 
                          ? '0 4px 16px rgba(100, 116, 139, 0.25)'
                          : '0 4px 16px rgba(14, 165, 233, 0.25)';
                      }}
                    >
                      {isExpanded ? 'Show Less' : 'Show More'}
                    </button>
                  </div>
                </div>
              )})}
            </div>
            )
          ) : activeTab === 'safe-food' ? (
            safeFoodLogs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
                <div style={{
                  background: 'linear-gradient(135deg, #e0e7ef 0%, #dcfce7 100%)',
                  borderRadius: '50%',
                  width: 70,
                  height: 70,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(34,197,94,0.10)',
                  marginBottom: 18
                }}>
                  <CheckCircle size={38} color="#22c55e" />
                </div>
                <h3 style={{ color: '#64748b', fontWeight: 600, fontSize: 22, marginBottom: 8 }}>No safe food logs found</h3>
                <p style={{ color: '#94a3b8', fontSize: 16 }}>You haven't submitted any safe food logs yet.</p>
              </div>
            ) : (
              <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 48, alignItems: 'center' }}>
                {safeFoodLogs.map((log, idx) => (
                  <div key={idx} style={{ 
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)', 
                    borderRadius: 24, 
                    boxShadow: '0 20px 60px rgba(34, 197, 94, 0.15), 0 8px 32px rgba(0, 0, 0, 0.08)', 
                    border: '2px solid rgba(34, 197, 94, 0.2)', 
                    padding: '2.5rem 2rem', 
                    width: '100%', 
                    maxWidth: 750, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    position: 'relative',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}>
                    {/* Delete Button */}
                    <button
                      onClick={() => log.docId && handleDeleteSafeFood(log.docId)}
                      disabled={deletingSafeFoods.has(log.docId || '')}
                      style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
                        transition: 'all 0.3s ease',
                        zIndex: 10,
                        opacity: deletingSafeFoods.has(log.docId || '') ? 0.6 : 1
                      }}
                      onMouseOver={(e) => {
                        if (!deletingSafeFoods.has(log.docId || '')) {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.35)';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.25)';
                      }}
                      title="Delete safe food log"
                    >
                      {deletingSafeFoods.has(log.docId || '') ? (
                        <div style={{
                          width: 16,
                          height: 16,
                          border: '2px solid #fff',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                    
                    <div style={{ 
                      position: 'absolute', 
                      top: 20, 
                      right: 28, 
                      opacity: 0.08, 
                      fontSize: 52,
                      color: '#22c55e'
                    }}>
                      <CheckCircle size={24} />
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 14, 
                      marginBottom: 28,
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      padding: '12px 24px',
                      borderRadius: 50,
                      boxShadow: '0 8px 24px rgba(34, 197, 94, 0.25)'
                    }}>
                      <CheckCircle size={24} color="#fff" />
                      <span style={{ fontWeight: 800, color: '#fff', fontSize: 16, letterSpacing: 0.5 }}>Safe Food #{safeFoodLogs.length - idx}</span>
                    </div>
                    
                    {/* Safe Food Details Section */}
                    <div style={{ width: '100%', marginBottom: 32 }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        borderRadius: 16,
                        padding: '16px 24px',
                        marginBottom: 24,
                        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.2)'
                      }}>
                        <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>✅ Safe Food Details</h3>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #fff 0%, #f0fdf4 100%)',
                          borderRadius: 16,
                          padding: '20px 24px',
                          border: '1px solid rgba(34, 197, 94, 0.15)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                        }}>
                          <label style={{ fontWeight: 700, color: '#334155', fontSize: 14, letterSpacing: 0.2, marginBottom: 8, display: 'block' }}>Time of Consumption</label>
                          <p style={{ color: '#1e293b', margin: 0, fontSize: 16, fontWeight: 600 }}>{new Date(log.time).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Safe Foods Section */}
                    <div style={{ width: '100%' }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        borderRadius: 16,
                        padding: '16px 24px',
                        marginBottom: 24,
                        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.2)'
                      }}>
                        <h3 style={{ fontWeight: 800, color: '#fff', fontSize: 20, textAlign: 'center', margin: 0, letterSpacing: 0.5 }}>🍽️ Safe Foods</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {log.products.map((product, pidx) => (
                          <div key={pidx} style={{ 
                            background: 'linear-gradient(135deg, #fff 0%, #f0fdf4 50%, #dcfce7 100%)', 
                            borderRadius: 20, 
                            padding: '24px 28px', 
                            border: '2px solid rgba(34, 197, 94, 0.2)', 
                            boxShadow: '0 12px 32px rgba(34, 197, 94, 0.15), 0 4px 16px rgba(0, 0, 0, 0.05)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: 16,
                            textAlign: 'center'
                          }}>
                            <div style={{ 
                              fontWeight: 800, 
                              fontSize: 18,
                              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                              color: '#fff',
                              padding: '8px 20px',
                              borderRadius: 50,
                              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
                            }}>
                              {product.name || `Safe Food ${pidx + 1}`}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                              {product.exposureType && (
                                <div style={{ 
                                  color: '#16a34a', 
                                  fontSize: 14, 
                                  fontWeight: 600,
                                  background: 'rgba(34, 197, 94, 0.1)',
                                  padding: '4px 12px',
                                  borderRadius: 8
                                }}>
                                  Type: {product.exposureType}
                                </div>
                              )}
                              {product.barcode && (
                                <div style={{ 
                                  color: '#16a34a', 
                                  fontSize: 14, 
                                  fontWeight: 600,
                                  background: 'rgba(34, 197, 94, 0.1)',
                                  padding: '4px 12px',
                                  borderRadius: 8
                                }}>
                                  Barcode: {product.barcode}
                                </div>
                              )}
                            </div>
                            
                            {product.commonList.length > 0 && (
                              <div style={{ width: '100%', textAlign: 'center' }}>
                                <label style={{ 
                                  fontWeight: 700, 
                                  color: '#16a34a', 
                                  fontSize: 14, 
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  marginBottom: 12, 
                                  display: 'block' 
                                }}>
                                  Safe Ingredients
                                </label>
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: 6,
                                  alignItems: 'center'
                                }}>
                                  {product.commonList.map((ingredient, iidx) => (
                                    <span key={iidx} style={{ 
                                      color: '#16a34a', 
                                      fontSize: 14,
                                      fontWeight: 500,
                                      background: 'rgba(34, 197, 94, 0.1)',
                                      padding: '6px 16px',
                                      borderRadius: 12,
                                      border: '1px solid rgba(34, 197, 94, 0.2)'
                                    }}>
                                      {ingredient}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
          
          {activeTab === 'allergy' && hasMoreLogs && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, marginBottom: 20 }}>
              <button 
                onClick={handleShowMore} 
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  color: '#fff',
                  padding: '16px 32px',
                  borderRadius: 50,
                  fontWeight: 700,
                  fontSize: 16,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(14, 165, 233, 0.25)',
                  transition: 'all 0.3s ease',
                  letterSpacing: 0.5
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(14, 165, 233, 0.35)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(14, 165, 233, 0.25)';
                }}
              >
                Show More Logs
              </button>
            </div>
          )}
        </div>
      </main>
      {pdfLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#0ea5e9' }}>Generating PDF Report...</span>
            <div style={{ width: 40, height: 40, border: '4px solid #bae6fd', borderTop: '4px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
