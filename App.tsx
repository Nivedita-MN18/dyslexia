// dyslexia_reader_app/App.tsx (or App.js if not using TypeScript)

import React, { useState, useEffect, useCallback, useMemo, JSX } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Button,
  Platform,
  Image,
} from 'react-native';

// FIX: Polyfill for Buffer. This is often needed for expo-av's BytesSource on some platforms.
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av'; // For playing audio
import * as Font from 'expo-font'; // For custom fonts
import Slider from '@react-native-community/slider'; // For sliders

// Define your backend URL
const BACKEND_URL = 'http://192.168.147.171:8000'; // Example for Android emulator, adjust as needed

// --- Main App Component ---
export default function App(): JSX.Element { 
  const [filePath, setFilePath] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [processedText, setProcessedText] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [quizData, setQuizData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const [currentView, setCurrentView] = useState<string>('actual');

  const [userGeminiApiKey, setUserGeminiApiKey] = useState<string | null>(null);
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState<boolean>(false);
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);
  const [currentHighlightSentence, setCurrentHighlightSentence] = useState<number>(-1);
  const [selectedAnswers, setSelectedAnswers] = useState<Array<string | null>>([]);

  const soundObject = React.useRef(new Audio.Sound());

  // --- Text customization settings ---
  const [fontSize, setFontSize] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.6);
  const [wordSpacing, setWordSpacing] = useState<number>(0.1);
  const [letterSpacing, setLetterSpacing] = useState<number>(0.05);
  const [textColor, setTextColor] = useState<string>('#333333');
  const [backgroundColor, setBackgroundColor] = useState<string>('#F0F2F6');
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState<boolean>(false);
  const [isQuizModalVisible, setIsQuizModalVisible] = useState<boolean>(false);

  // Create dynamic text style based on customization settings
  const dynamicTextStyle = useMemo(() => ({
    fontSize: fontSize,
    lineHeight: fontSize * lineHeight,
    letterSpacing: letterSpacing,
    color: textColor,
    fontFamily: 'OpenDyslexic',
    textAlign: 'justify' as const,
  }), [fontSize, lineHeight, letterSpacing, textColor]);

  // --- Load Fonts and Settings on App Start ---
  useEffect(() => {
    async function loadResourcesAndDataAsync() {
      try {
        await Font.loadAsync({
          'OpenDyslexic': require('./assets/fonts/OpenDyslexic-Bold.ttf'),
        });
        setFontsLoaded(true);

        const storedKey = await AsyncStorage.getItem('gemini_api_key');
        if (storedKey) {
          setUserGeminiApiKey(storedKey);
        }
      } catch (e) {
        console.warn("Failed to load fonts or settings:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadResourcesAndDataAsync();
  }, []);

  // Determine which text to display based on current view mode
  const textToDisplay = useMemo(() => {
    switch (currentView) {
      case 'actual':
        return extractedText;
      case 'simplified':
        return processedText;
      case 'summary':
        return processedText;
      default:
        return extractedText;
    }
  }, [extractedText, processedText, currentView]);

  // --- Save API Key ---
  // This now only saves it locally for the app's internal check, not for sending to backend
  const saveApiKey = async (key: string) => {
    try {
      await AsyncStorage.setItem('gemini_api_key', key);
      setUserGeminiApiKey(key);
      Alert.alert('Success', 'API Key saved locally!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save API Key locally.');
    }
  };

  // --- File Picking ---
  const pickDocument = async () => {
    // FIX: Removed API key check here, as backend uses its own hardcoded key.
    // If you still want an API key input gate, keep this check.
    // For now, I'll keep the check but make it clear it's a frontend-only gate.
    if (!userGeminiApiKey || userGeminiApiKey.trim().length === 0) {
      setIsApiKeyModalVisible(true);
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (res.canceled === false && res.assets && res.assets.length > 0) {
        setFilePath(res.assets[0].uri);
        setExtractedText('');
        setProcessedText('');
        setImageUrls([]);
        setQuizData([]);
        setSelectedAnswers([]);
        setIsLoading(true);
        setCurrentView('actual');
        uploadAndProcessPdf(res.assets[0].uri);
      } else {
        Alert.alert('Cancelled', 'File picking cancelled.');
      }
    } catch (err: any) {
      console.error('DocumentPicker Error:', err);
      Alert.alert('Error', 'Failed to pick document: ' + err.message);
      setIsLoading(false);
    }
  };

  // --- PDF Upload and Initial Processing (Backend Call) ---
  const uploadAndProcessPdf = async (uri: string) => {
    setIsLoading(true);
    setExtractedText('Uploading and extracting content...');


    try {
      const fileUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
      const file = {
        uri: fileUri,
        name: uri.split('/').pop() || 'document.pdf',
        type: 'application/pdf',
      };

      const formData = new FormData();
      formData.append('pdf_file', file as any);

      const response = await axios.post(`${BACKEND_URL}/upload_pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          // FIX: Removed X-Gemini-Api-Key header
          // 'X-Gemini-Api-Key': apiKey,
        },
        timeout: 600000,
      });

      setExtractedText(response.data.text || 'No text extracted.');
      setImageUrls(response.data.image_urls || []);
      setIsLoading(false);
      setCurrentView('actual');
    } catch (error: any) {
      console.error('Upload/Process PDF Error:', error.response?.data || error.message);
      setExtractedText(`Error: ${error.response?.data?.detail || error.message}`);
      setIsLoading(false);
      Alert.alert('Error', `Failed to upload/process PDF: ${error.response?.data?.detail || error.message}`);
    }
  };

  // --- Text Processing (Backend Calls for Simplify/Summarize) ---
  const processText = async (mode: string) => {
    if (!extractedText || extractedText.trim().length === 0) {
      Alert.alert('No Text', 'No text extracted from PDF to process.');
      return;
    }
    // FIX: Removed API key check here, as backend uses its own hardcoded key.
    // const apiKey = userGeminiApiKey;
    // if (!apiKey || apiKey.trim().length === 0) {
    //   setIsApiKeyModalVisible(true);
    //   return;
    // }

    setIsLoading(true);
    setProcessedText('Processing...');

    try {
      let endpoint = '';
      if (mode === 'simplified') {
        endpoint = '/simplify_text';
      } else if (mode === 'summary') {
        endpoint = '/summarize_text';
      }

      const response = await axios.post(`${BACKEND_URL}${endpoint}`, { text: extractedText }, {
        headers: {
          'Content-Type': 'application/json',
          // FIX: Removed X-Gemini-Api-Key header
          // 'X-Gemini-Api-Key': apiKey,
        },
        timeout: 300000,
      });

      setProcessedText(response.data[mode === 'simplified' ? 'simplified_text' : 'summary'] || 'No result.');
      setIsLoading(false);
      setCurrentView(mode);
    } catch (error: any) {
      console.error('Process Text Error:', error.response?.data || error.message);
      setProcessedText(`Error: ${error.response?.data?.detail || error.message}`);
      setIsLoading(false);
      Alert.alert('Error', `Failed to process text: ${error.response?.data?.detail || error.message}`);
    }
  };

  // --- Quiz Generation (Backend Call) ---
  const generateQuiz = async () => {
    const textForQuiz = currentView === 'simplified' ? processedText : extractedText;
    if (!textForQuiz || textForQuiz.trim().length === 0) {
      Alert.alert('No Text', 'No text available to generate quiz.');
      return;
    }
    // FIX: Removed API key check here, as backend uses its own hardcoded key.
    // const apiKey = userGeminiApiKey;
    // if (!apiKey || apiKey.trim().length === 0) {
    //   setIsApiKeyModalVisible(true);
    //   return;
    // }

    setIsLoading(true);
    setQuizData([]);
    setSelectedAnswers(Array(quizData.length).fill(null));

    try {
      const response = await axios.post(`${BACKEND_URL}/generate_quiz`, { text: textForQuiz }, {
        headers: {
          'Content-Type': 'application/json',
          // FIX: Removed X-Gemini-Api-Key header
          // 'X-Gemini-Api-Key': apiKey,
        },
        timeout: 300000,
      });

      setQuizData(response.data.quiz || []);
      setIsLoading(false);
      setIsQuizModalVisible(true);
    } catch (error: any) {
      console.error('Generate Quiz Error:', error.response?.data || error.message);
      setIsLoading(false);
      Alert.alert('Error', `Failed to generate quiz: ${error.response?.data?.detail || error.message}`);
    }
  };

  // --- TTS Playback (Backend Call for Audio) ---
  const speakText = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    // FIX: Removed API key check here, as backend uses its own hardcoded key.
    // const apiKey = userGeminiApiKey;
    // if (!apiKey || apiKey.trim().length === 0) {
    //   setIsApiKeyModalVisible(true);
    //   return;
    // }

    setCurrentHighlightSentence(-1); // Reset highlight

    const sentences = text.split(/(?<=[.!?])\s+/);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      setCurrentHighlightSentence(i); // Highlight current sentence

      try {
        // Use backend for TTS audio generation
        const response = await axios.post(`${BACKEND_URL}/get_audio`, { text: sentence }, {
          headers: {
            'Content-Type': 'application/json',
            // FIX: Removed X-Gemini-Api-Key header
            // 'X-Gemini-Api-Key': apiKey,
          },
          responseType: 'arraybuffer',
          timeout: 60000,
        });

        if (response.status === 200) {
          const audioData = response.data;
          const status = await soundObject.current.getStatusAsync();
          if (status.isLoaded) {
            await soundObject.current.unloadAsync();
          }
          await soundObject.current.loadAsync({ uri: `data:audio/mpeg;base64,${Buffer.from(audioData).toString('base64')}` });
          await soundObject.current.playAsync();
          
          await new Promise<void>(resolve => {
            soundObject.current.setOnPlaybackStatusUpdate((playbackStatus: any) => {
              if (playbackStatus.didJustFinish) {
                resolve();
              }
            });
          });
          await soundObject.current.unloadAsync();
        } else {
          throw new Error(`Failed to get audio: ${response.status}`);
        }
      } catch (error: any) {
        console.error('Speak Text Error:', error.message);
        Alert.alert('Error', `Failed to play audio: ${error.message}`);
        break;
      }
    }
    setCurrentHighlightSentence(-1);
  };

  // --- Display Content based on View Mode ---
  const displayContent = useCallback((text: string, mode: string) => {
    setCurrentView(mode);
  }, []);

  // --- Quiz Dialog (Implemented as a proper Modal) ---
  const showQuizDialog = () => {
    setSelectedAnswers(Array(quizData.length).fill(null)); 
    setIsQuizModalVisible(true);
  };

  const submitQuiz = () => {
    let score = 0;
    for (let i = 0; i < quizData.length; i++) {
      const selected = selectedAnswers[i];
      if (selected && selected.startsWith(quizData[i].correct_answer)) {
        score++;
      }
    }
    Alert.alert('Quiz Results', `You scored ${score} out of ${quizData.length}!`);
    setIsQuizModalVisible(false);
  };

  // --- Render Loading Screen while Fonts Load ---
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading Fonts...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      {/* API Key Input Modal (Still present for local storage, but not for backend communication) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isApiKeyModalVisible}
        onRequestClose={() => setIsApiKeyModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Enter Gemini API Key</Text>
            <Text style={styles.modalText}>
              This key is used for local app functionality. The backend uses its own key.
              You can get one for free from Google AI Studio (aistudio.google.com).
            </Text>
            <TextInput
              style={styles.input}
              placeholder="YOUR_GEMINI_API_KEY"
              onChangeText={setUserGeminiApiKey}
              value={userGeminiApiKey || ''}
              secureTextEntry={true}
            />
            <Button title="Save Key" onPress={() => {
              if (userGeminiApiKey && userGeminiApiKey.trim().length > 0) {
                saveApiKey(userGeminiApiKey);
                setIsApiKeyModalVisible(false);
              } else {
                Alert.alert('Error', 'API Key cannot be empty!');
              }
            }} />
            <Button title="Cancel" onPress={() => setIsApiKeyModalVisible(false)} color="red" />
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isSettingsModalVisible}
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Text style={styles.settingLabel}>Font Size: {fontSize.toFixed(0)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={14}
              maximumValue={30}
              step={1}
              value={fontSize}
              onValueChange={setFontSize}
            />
            <Text style={styles.settingLabel}>Line Spacing: {lineHeight.toFixed(1)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={1.2}
              maximumValue={2.5}
              step={0.1}
              value={lineHeight}
              onValueChange={setLineHeight}
            />
            <Text style={styles.settingLabel}>Word Spacing: {wordSpacing.toFixed(2)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0.0}
              maximumValue={0.5}
              step={0.01}
              value={wordSpacing}
              onValueChange={setWordSpacing}
            />
            <Text style={styles.settingLabel}>Letter Spacing: {letterSpacing.toFixed(2)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0.0}
              maximumValue={0.2}
              step={0.01}
              value={letterSpacing}
              onValueChange={setLetterSpacing}
            />
            <Text style={styles.settingLabel}>Text Color: {textColor}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., #333333"
              value={textColor}
              onChangeText={setTextColor}
            />
            <Text style={styles.settingLabel}>Background Color: {backgroundColor}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., #F0F2F6"
              value={backgroundColor}
              onChangeText={setBackgroundColor}
            />
            <Button title="Close Settings" onPress={() => setIsSettingsModalVisible(false)} />
          </View>
        </View>
      </Modal>

      {/* Quiz Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isQuizModalVisible}
        onRequestClose={() => setIsQuizModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, styles.quizModalView]}>
            <Text style={styles.modalTitle}>Comprehension Quiz</Text>
            <ScrollView style={styles.quizScrollView}>
              {quizData.map((q, i) => (
                <View key={i} style={styles.quizQuestionContainer}>
                  <Text style={styles.quizQuestionText}>Question {i + 1}: {q.question}</Text>
                  {q.options.map((option: string, optionIndex: number) => (
                    <TouchableOpacity
                      key={optionIndex}
                      style={styles.quizOptionButton}
                      onPress={() => {
                        const newSelectedAnswers = [...selectedAnswers];
                        newSelectedAnswers[i] = option;
                        setSelectedAnswers(newSelectedAnswers);
                      }}
                    >
                      <View style={styles.radioButton}>
                        {selectedAnswers[i] === option && <View style={styles.radioButtonInner} />}
                      </View>
                      <Text style={styles.quizOptionText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
            <View style={styles.quizActions}>
              <Button title="Submit Quiz" onPress={submitQuiz} />
              <Button title="Close" onPress={() => setIsQuizModalVisible(false)} color="red" />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.appTitle}>Dyslexia Reader</Text>
        <TouchableOpacity onPress={() => setIsSettingsModalVisible(true)}>
          <Text style={styles.settingsButton}>Settings</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.uploadButton} onPress={pickDocument} disabled={isLoading}>
        <Text style={styles.uploadButtonText}>Upload PDF</Text>
      </TouchableOpacity>

      {filePath && (
        <Text style={styles.fileName}>Selected: {filePath.split('/').pop()}</Text>
      )}

      <View style={styles.viewModeButtons}>
        <TouchableOpacity
          style={[styles.viewModeButton, currentView === 'actual' && styles.viewModeButtonActive]}
          onPress={() => displayContent(extractedText, 'actual')}
          disabled={isLoading || !extractedText || extractedText.trim().length === 0}
        >
          <Text style={[styles.viewModeButtonText, currentView === 'actual' && styles.viewModeButtonTextActive]}>Actual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, currentView === 'simplified' && styles.viewModeButtonActive]}
          onPress={() => processText('simplified')}
          disabled={isLoading || !extractedText || extractedText.trim().length === 0}
        >
          <Text style={[styles.viewModeButtonText, currentView === 'simplified' && styles.viewModeButtonTextActive]}>Simplified</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, currentView === 'summary' && styles.viewModeButtonActive]}
          onPress={() => processText('summary')}
          disabled={isLoading || !extractedText || extractedText.trim().length === 0}
        >
          <Text style={[styles.viewModeButtonText, currentView === 'summary' && styles.viewModeButtonTextActive]}>Summary</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.spinner} />
      ) : (
        <ScrollView style={styles.contentScrollView}>
          {imageUrls.map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={styles.contentImage}
              resizeMode="contain"
            />
          ))}
          <Text style={dynamicTextStyle}>
            {textToDisplay}
          </Text>
          {currentView !== 'summary' && textToDisplay.trim().length > 0 && (
            <TouchableOpacity style={styles.quizButton} onPress={generateQuiz}>
              <Text style={styles.quizButtonText}>Generate Quiz</Text>
            </TouchableOpacity>
          )}
          {textToDisplay.trim().length > 0 && (
            <TouchableOpacity style={styles.listenButton} onPress={() => speakText(textToDisplay)}>
              <Text style={styles.listenButtonText}>Listen to Text</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50, // Adjust for status bar
    alignItems: 'center',
    backgroundColor: '#F0F2F6', // Default background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F6',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'OpenDyslexic',
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'OpenDyslexic',
    marginBottom: 8,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'OpenDyslexic',
  },
  settingsButton: {
    fontSize: 16,
    color: 'blue',
    fontFamily: 'OpenDyslexic',
  },
  uploadButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginBottom: 20,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'OpenDyslexic',
  },
  fileName: {
    fontSize: 16,
    marginBottom: 20,
    fontFamily: 'OpenDyslexic',
  },
  viewModeButtons: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  viewModeButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginHorizontal: 5,
    backgroundColor: '#ADD8E6', // Light blue
  },
  viewModeButtonActive: {
    backgroundColor: '#007bff', // Darker blue when active
  },
  viewModeButtonText: {
    color: 'white',
    fontFamily: 'OpenDyslexic',
  },
  viewModeButtonTextActive: {
    fontWeight: 'bold',
  },
  spinner: {
    marginTop: 50,
  },
  contentScrollView: {
    flex: 1,
    width: '90%',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  contentImage: {
    width: '100%',
    height: 200, // Adjust height as needed, or make dynamic
    marginBottom: 10,
  },
  quizButton: {
    backgroundColor: 'green',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  quizButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'OpenDyslexic',
  },
  listenButton: {
    backgroundColor: 'purple',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    alignSelf: 'center',
  },
  listenButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'OpenDyslexic',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  quizModalView: {
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    fontFamily: 'OpenDyslexic',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: 'OpenDyslexic',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    fontFamily: 'OpenDyslexic',
  },
  slider: {
    width: 200,
    height: 40,
  },
  quizScrollView: {
    maxHeight: 300,
    width: '100%',
    marginBottom: 20,
  },
  quizQuestionContainer: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quizQuestionText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: 'OpenDyslexic',
  },
  quizOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  radioButton: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioButtonInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#007bff',
  },
  quizOptionText: {
    fontSize: 15,
    fontFamily: 'OpenDyslexic',
  },
  quizActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
});

// Helper for color picker (React Native doesn't have a built-in one like Flutter)
const showColorPicker = async (context: any, currentColor: string): Promise<string | null> => {
  return new Promise((resolve) => {
    Alert.prompt(
      'Enter Color (Hex)',
      'e.g., #RRGGBB or #RGB',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'OK', onPress: (text) => resolve(text || null) },
      ],
      'plain-text',
      currentColor
    );
  });
};
