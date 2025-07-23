"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
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
  Platform,
  Image,
  StatusBar,
  SafeAreaView,
} from "react-native"
// Polyfill for Buffer
import { Buffer } from "buffer"
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer
}
import * as DocumentPicker from "expo-document-picker"
import * as ImagePicker from "expo-image-picker"
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Audio } from "expo-av"
import * as Font from "expo-font"
import Slider from "@react-native-community/slider"
import { LinearGradient } from "expo-linear-gradient"
import { SplashScreen } from "./components/SplashScreen"
import { Book, Camera, Settings, FileText, Volume2, HelpCircle, Printer, Sun, Moon } from "react-native-feather"

// Define your backend URL
const BACKEND_URL = "http://192.168.147.171:8000" // Example for Android emulator, adjust as needed

// --- Main App Component ---
export default function App() {
  const [filePath, setFilePath] = useState(null)
  const [extractedText, setExtractedText] = useState("")
  const [processedText, setProcessedText] = useState("")
  const [imageUrls, setImageUrls] = useState([])
  const [quizData, setQuizData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [currentView, setCurrentView] = useState("actual")
  const [userGeminiApiKey, setUserGeminiApiKey] = useState(null)
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const [currentHighlightSentence, setCurrentHighlightSentence] = useState(-1)
  const [selectedAnswers, setSelectedAnswers] = useState([])
  const [showSplash, setShowSplash] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const soundObject = React.useRef(new Audio.Sound())

  // --- Text customization settings ---
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.6)
  const [wordSpacing, setWordSpacing] = useState(0.1)
  const [letterSpacing, setLetterSpacing] = useState(0.05)
  const [textColor, setTextColor] = useState("#333333")
  const [backgroundColor, setBackgroundColor] = useState("#F0F2F6")
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false)
  const [isQuizModalVisible, setIsQuizModalVisible] = useState(false)

  // Helper to reset state before new content upload
  const resetState = () => {
    setFilePath(null)
    setExtractedText("")
    setProcessedText("")
    setImageUrls([])
    setQuizData([])
    setSelectedAnswers([])
    setCurrentView("actual")
    setIsLoading(true)
  }

  // Create dynamic text style based on customization settings
  const dynamicTextStyle = useMemo(
      () => ({
        fontSize: fontSize,
        lineHeight: fontSize * lineHeight,
        letterSpacing: letterSpacing,
        color: darkMode ? "#E0E0E0" : textColor,
        fontFamily: "OpenDyslexic",
        textAlign: "justify",
      }),
      [fontSize, lineHeight, letterSpacing, textColor, darkMode],
  )

  // --- Load Fonts and Settings on App Start ---
  useEffect(() => {
    async function loadResourcesAndDataAsync() {
      try {
        await Font.loadAsync({
          OpenDyslexic: require("./assets/fonts/OpenDyslexic-Bold.ttf"),
          "OpenDyslexic-Regular": require("./assets/fonts/OpenDyslexic-Regular.ttf"),
        })
        setFontsLoaded(true)
        const storedKey = await AsyncStorage.getItem("gemini_api_key")
        if (storedKey) {
          setUserGeminiApiKey(storedKey)
        }

        // Check for dark mode preference
        const darkModePref = await AsyncStorage.getItem("dark_mode")
        if (darkModePref === "true") {
          setDarkMode(true)
          setTextColor("#E0E0E0")
          setBackgroundColor("#121212")
        }

        // Show splash screen for 2.5 seconds
        setTimeout(() => {
          setShowSplash(false)
          setIsLoading(false)
        }, 2500)
      } catch (e) {
        console.warn("Failed to load fonts or settings:", e)
        setIsLoading(false)
        setShowSplash(false)
      }
    }
    loadResourcesAndDataAsync()
  }, [])

  const pickImageFromCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "You need to grant camera permissions to use this feature.")
      return
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      })
      if (!result.canceled && result.assets && result.assets.length > 0) {
        resetState()
        setFilePath(result.assets[0].uri)
        uploadAndProcessImage(result.assets[0].uri)
      }
    } catch (err) {
      Alert.alert("Error", "Failed to capture image: " + err.message)
      setIsLoading(false)
    }
  }

  // Determine which text to display based on current view mode
  const textToDisplay = useMemo(() => {
    switch (currentView) {
      case "actual":
        return extractedText
      case "simplified":
        return processedText
      case "summary":
        return processedText
      default:
        return extractedText
    }
  }, [extractedText, processedText, currentView])

  // --- Save API Key ---
  const saveApiKey = async (key) => {
    try {
      await AsyncStorage.setItem("gemini_api_key", key)
      setUserGeminiApiKey(key)
      Alert.alert("Success", "API Key saved locally!")
    } catch (e) {
      Alert.alert("Error", "Failed to save API Key locally.")
    }
  }

  // --- Toggle Dark Mode ---
  const toggleDarkMode = async () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      setTextColor("#E0E0E0")
      setBackgroundColor("#121212")
    } else {
      setTextColor("#333333")
      setBackgroundColor("#F0F2F6")
    }
    await AsyncStorage.setItem("dark_mode", newMode.toString())
  }

  // --- File Picking ---
  const pickDocument = async () => {
    if (!userGeminiApiKey || userGeminiApiKey.trim().length === 0) {
      setIsApiKeyModalVisible(true)
      return
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      })
      if (res.canceled === false && res.assets && res.assets.length > 0) {
        setFilePath(res.assets[0].uri)
        setExtractedText("")
        setProcessedText("")
        setImageUrls([])
        setQuizData([])
        setSelectedAnswers([])
        setIsLoading(true)
        setCurrentView("actual")
        uploadAndProcessPdf(res.assets[0].uri)
      } else {
        Alert.alert("Cancelled", "File picking cancelled.")
      }
    } catch (err) {
      console.error("DocumentPicker Error:", err)
      Alert.alert("Error", "Failed to pick document: " + err.message)
      setIsLoading(false)
    }
  }

  // --- PDF Upload and Initial Processing (Backend Call) ---
  const uploadAndProcessPdf = async (uri) => {
    setIsLoading(true)
    setExtractedText("Uploading and extracting content...")
    try {
      const fileUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri
      const file = {
        uri: fileUri,
        name: uri.split("/").pop() || "document.pdf",
        type: "application/pdf",
      }
      const formData = new FormData()
      formData.append("pdf_file", file)
      const response = await axios.post(`${BACKEND_URL}/upload_pdf`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 600000,
      })
      setExtractedText(response.data.text || "No text extracted.")
      setImageUrls(response.data.image_urls || [])
      setIsLoading(false)
      setCurrentView("actual")
    } catch (error) {
      console.error("Upload/Process PDF Error:", error.response?.data || error.message)
      setExtractedText(`Error: ${error.response?.data?.detail || error.message}`)
      setIsLoading(false)
      Alert.alert("Error", `Failed to upload/process PDF: ${error.response?.data?.detail || error.message}`)
    }
  }

  // Upload and Process Image function
  const uploadAndProcessImage = async (uri) => {
    const formData = new FormData()
    const fileType = uri.endsWith(".png") ? "image/png" : "image/jpeg"
    formData.append("image_file", {
      uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
      name: uri.split("/").pop() || "photo.jpg",
      type: fileType,
    })
    try {
      const response = await axios.post(`${BACKEND_URL}/upload_image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
      })
      setExtractedText(response.data.text || "No text extracted from image.")
      setImageUrls(response.data.image_urls || [])
    } catch (error) {
      Alert.alert("Error", `Failed to process image: ${error.response?.data?.detail || error.message}`)
      setExtractedText(`Error: ${error.response?.data?.detail || error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Text Processing (Backend Calls for Simplify/Summarize) ---
  const processText = async (mode) => {
    if (!extractedText || extractedText.trim().length === 0) {
      Alert.alert("No Text", "No text extracted from PDF to process.")
      return
    }
    setIsLoading(true)
    setProcessedText("Processing...")
    try {
      let endpoint = ""
      if (mode === "simplified") {
        endpoint = "/simplify_text"
      } else if (mode === "summary") {
        endpoint = "/summarize_text"
      }
      const response = await axios.post(
          `${BACKEND_URL}${endpoint}`,
          { text: extractedText },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 300000,
          },
      )
      setProcessedText(response.data[mode === "simplified" ? "simplified_text" : "summary"] || "No result.")
      setIsLoading(false)
      setCurrentView(mode)
    } catch (error) {
      console.error("Process Text Error:", error.response?.data || error.message)
      setProcessedText(`Error: ${error.response?.data?.detail || error.message}`)
      setIsLoading(false)
      Alert.alert("Error", `Failed to process text: ${error.response?.data?.detail || error.message}`)
    }
  }

  // --- Quiz Generation (Backend Call) ---
  const generateQuiz = async () => {
    const textForQuiz = currentView === "simplified" ? processedText : extractedText
    if (!textForQuiz || textForQuiz.trim().length === 0) {
      Alert.alert("No Text", "No text available to generate quiz.")
      return
    }
    setIsLoading(true)
    setQuizData([])
    setSelectedAnswers(Array(quizData.length).fill(null))
    try {
      const response = await axios.post(
          `${BACKEND_URL}/generate_quiz`,
          { text: textForQuiz },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 300000,
          },
      )
      setQuizData(response.data.quiz || [])
      setIsLoading(false)
      setIsQuizModalVisible(true)
    } catch (error) {
      console.error("Generate Quiz Error:", error.response?.data || error.message)
      setIsLoading(false)
      Alert.alert("Error", `Failed to generate quiz: ${error.response?.data?.detail || error.message}`)
    }
  }

  // --- TTS Playback (Backend Call for Audio) ---
  const speakText = async (text) => {
    if (!text || text.trim().length === 0) return
    setCurrentHighlightSentence(-1) // Reset highlight
    const sentences = text.split(/(?<=[.!?])\s+/)
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (!sentence) continue
      setCurrentHighlightSentence(i) // Highlight current sentence
      try {
        // Use backend for TTS audio generation
        const response = await axios.post(
            `${BACKEND_URL}/get_audio`,
            { text: sentence },
            {
              headers: {
                "Content-Type": "application/json",
              },
              responseType: "arraybuffer",
              timeout: 60000,
            },
        )
        if (response.status === 200) {
          const audioData = response.data
          const status = await soundObject.current.getStatusAsync()
          if (status.isLoaded) {
            await soundObject.current.unloadAsync()
          }
          await soundObject.current.loadAsync({
            uri: `data:audio/mpeg;base64,${Buffer.from(audioData).toString("base64")}`,
          })
          await soundObject.current.playAsync()

          await new Promise((resolve) => {
            soundObject.current.setOnPlaybackStatusUpdate((playbackStatus) => {
              if (playbackStatus.didJustFinish) {
                resolve()
              }
            })
          })
          await soundObject.current.unloadAsync()
        } else {
          throw new Error(`Failed to get audio: ${response.status}`)
        }
      } catch (error) {
        console.error("Speak Text Error:", error.message)
        Alert.alert("Error", `Failed to play audio: ${error.message}`)
        break
      }
    }
    setCurrentHighlightSentence(-1)
  }

  // --- Display Content based on View Mode ---
  const displayContent = useCallback((text, mode) => {
    setCurrentView(mode)
  }, [])

  // --- Quiz Dialog (Implemented as a proper Modal) ---
  const showQuizDialog = () => {
    setSelectedAnswers(Array(quizData.length).fill(null))
    setIsQuizModalVisible(true)
  }

  // Print to PDF function
  const printToPdf = async () => {
    if (!textToDisplay.trim()) {
      Alert.alert("No Content", "There is no text to print.")
      return
    }
    const htmlContent = `
      <html>
        <head>
          <style>
            body {
              font-family: 'OpenDyslexic', sans-serif;
              font-size: ${fontSize}px;
              line-height: ${lineHeight};
              letter-spacing: ${letterSpacing}em;
              color: ${textColor};
              margin: 40px;
              text-align: justify;
              word-wrap: break-word;
            }
            h1 {
              font-size: ${fontSize * 1.5}px;
              color: #000;
              border-bottom: 2px solid #ccc;
              padding-bottom: 10px;
            }
            p {
              white-space: pre-wrap; /* Preserves line breaks from original text */
            }
          </style>
        </head>
        <body>
          <h1>${currentView.charAt(0).toUpperCase() + currentView.slice(1)} View</h1>
          <p>${textToDisplay}</p>
        </body>
      </html>
    `
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent })
      console.log("PDF generated at:", uri)
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing not available", "Sharing is not available on your platform.")
        return
      }
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share or Save PDF" })
    } catch (error) {
      Alert.alert("PDF Error", "Failed to create or share the PDF file: " + error.message)
    }
  }

  const submitQuiz = () => {
    let score = 0
    for (let i = 0; i < quizData.length; i++) {
      const selected = selectedAnswers[i]
      if (selected && selected.startsWith(quizData[i].correct_answer)) {
        score++
      }
    }
    Alert.alert("Quiz Results", `You scored ${score} out of ${quizData.length}!`)
    setIsQuizModalVisible(false)
  }

  // Show splash screen
  if (showSplash) {
    return <SplashScreen />
  }

  // --- Render Loading Screen while Fonts Load ---
  if (!fontsLoaded) {
    return (
        <View style={[styles.loadingContainer, darkMode && styles.darkBackground]}>
          <ActivityIndicator size="large" color={darkMode ? "#4dabf7" : "#0000ff"} />
          <Text style={[styles.loadingText, darkMode && styles.darkText]}>Loading Fonts...</Text>
        </View>
    )
  }

  return (
      <SafeAreaView style={[styles.safeArea, darkMode && styles.darkBackground]}>
        <StatusBar
            barStyle={darkMode ? "light-content" : "dark-content"}
            backgroundColor={darkMode ? "#121212" : "#F0F2F6"}
        />

        {/* API Key Input Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={isApiKeyModalVisible}
            onRequestClose={() => setIsApiKeyModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={[styles.modalView, darkMode && styles.darkModalView]}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Enter Gemini API Key</Text>
              <Text style={[styles.modalText, darkMode && styles.darkText]}>
                This key is used for local app functionality. The backend uses its own key. You can get one for free from
                Google AI Studio (aistudio.google.com).
              </Text>
              <TextInput
                  style={[styles.input, darkMode && styles.darkInput]}
                  placeholder="YOUR_GEMINI_API_KEY"
                  placeholderTextColor={darkMode ? "#888" : "#999"}
                  onChangeText={setUserGeminiApiKey}
                  value={userGeminiApiKey || ""}
                  secureTextEntry={true}
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={() => {
                      if (userGeminiApiKey && userGeminiApiKey.trim().length > 0) {
                        saveApiKey(userGeminiApiKey)
                        setIsApiKeyModalVisible(false)
                      } else {
                        Alert.alert("Error", "API Key cannot be empty!")
                      }
                    }}
                >
                  <Text style={styles.modalButtonText}>Save Key</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setIsApiKeyModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
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
            <View style={[styles.modalView, styles.settingsModalView, darkMode && styles.darkModalView]}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Settings</Text>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>Font Size: {fontSize.toFixed(0)}</Text>
                <Slider
                    style={styles.slider}
                    minimumValue={14}
                    maximumValue={30}
                    step={1}
                    value={fontSize}
                    onValueChange={setFontSize}
                    minimumTrackTintColor={darkMode ? "#4dabf7" : "#007bff"}
                    maximumTrackTintColor={darkMode ? "#555" : "#ccc"}
                    thumbTintColor={darkMode ? "#4dabf7" : "#007bff"}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>
                  Line Spacing: {lineHeight.toFixed(1)}
                </Text>
                <Slider
                    style={styles.slider}
                    minimumValue={1.2}
                    maximumValue={2.5}
                    step={0.1}
                    value={lineHeight}
                    onValueChange={setLineHeight}
                    minimumTrackTintColor={darkMode ? "#4dabf7" : "#007bff"}
                    maximumTrackTintColor={darkMode ? "#555" : "#ccc"}
                    thumbTintColor={darkMode ? "#4dabf7" : "#007bff"}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>
                  Word Spacing: {wordSpacing.toFixed(2)}
                </Text>
                <Slider
                    style={styles.slider}
                    minimumValue={0.0}
                    maximumValue={0.5}
                    step={0.01}
                    value={wordSpacing}
                    onValueChange={setWordSpacing}
                    minimumTrackTintColor={darkMode ? "#4dabf7" : "#007bff"}
                    maximumTrackTintColor={darkMode ? "#555" : "#ccc"}
                    thumbTintColor={darkMode ? "#4dabf7" : "#007bff"}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>
                  Letter Spacing: {letterSpacing.toFixed(2)}
                </Text>
                <Slider
                    style={styles.slider}
                    minimumValue={0.0}
                    maximumValue={0.2}
                    step={0.01}
                    value={letterSpacing}
                    onValueChange={setLetterSpacing}
                    minimumTrackTintColor={darkMode ? "#4dabf7" : "#007bff"}
                    maximumTrackTintColor={darkMode ? "#555" : "#ccc"}
                    thumbTintColor={darkMode ? "#4dabf7" : "#007bff"}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>Text Color:</Text>
                <TextInput
                    style={[styles.colorInput, darkMode && styles.darkInput]}
                    placeholder="e.g., #333333"
                    placeholderTextColor={darkMode ? "#888" : "#999"}
                    value={textColor}
                    onChangeText={setTextColor}
                />
                <View style={[styles.colorPreview, { backgroundColor: textColor }]} />
              </View>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>Background Color:</Text>
                <TextInput
                    style={[styles.colorInput, darkMode && styles.darkInput]}
                    placeholder="e.g., #F0F2F6"
                    placeholderTextColor={darkMode ? "#888" : "#999"}
                    value={backgroundColor}
                    onChangeText={setBackgroundColor}
                />
                <View style={[styles.colorPreview, { backgroundColor: backgroundColor }]} />
              </View>

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, darkMode && styles.darkText]}>Dark Mode:</Text>
                <TouchableOpacity style={styles.toggleButton} onPress={toggleDarkMode}>
                  {darkMode ? (
                      <Moon stroke="#fff" width={24} height={24} />
                  ) : (
                      <Sun stroke="#000" width={24} height={24} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                  style={[styles.modalButton, styles.closeButton]}
                  onPress={() => setIsSettingsModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Close Settings</Text>
              </TouchableOpacity>
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
            <View style={[styles.modalView, styles.quizModalView, darkMode && styles.darkModalView]}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Comprehension Quiz</Text>
              <ScrollView style={styles.quizScrollView}>
                {quizData.map((q, i) => (
                    <View key={i} style={styles.quizQuestionContainer}>
                      <Text style={[styles.quizQuestionText, darkMode && styles.darkText]}>
                        Question {i + 1}: {q.question}
                      </Text>
                      {q.options.map((option, optionIndex) => (
                          <TouchableOpacity
                              key={optionIndex}
                              style={[
                                styles.quizOptionButton,
                                selectedAnswers[i] === option && styles.selectedOption,
                                darkMode && styles.darkQuizOption,
                                selectedAnswers[i] === option && darkMode && styles.darkSelectedOption,
                              ]}
                              onPress={() => {
                                const newSelectedAnswers = [...selectedAnswers]
                                newSelectedAnswers[i] = option
                                setSelectedAnswers(newSelectedAnswers)
                              }}
                          >
                            <View style={[styles.radioButton, darkMode && styles.darkRadioButton]}>
                              {selectedAnswers[i] === option && (
                                  <View style={[styles.radioButtonInner, darkMode && styles.darkRadioButtonInner]} />
                              )}
                            </View>
                            <Text style={[styles.quizOptionText, darkMode && styles.darkText]}>{option}</Text>
                          </TouchableOpacity>
                      ))}
                    </View>
                ))}
              </ScrollView>
              <View style={styles.quizActions}>
                <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={submitQuiz}>
                  <Text style={styles.modalButtonText}>Submit Quiz</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setIsQuizModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={[styles.container, { backgroundColor: darkMode ? "#121212" : backgroundColor }]}>
          {/* --- HEADER --- */}
          <LinearGradient
              colors={darkMode ? ["#1A1A1A", "#121212"] : ["#6a11cb", "#2575fc"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.header}
          >
            <View style={styles.headerContent}>
              <Text style={styles.appTitle}>Dyslexia Reader</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity style={styles.iconButton} onPress={toggleDarkMode}>
                  {darkMode ? (
                      <Sun stroke="#fff" width={24} height={24} />
                  ) : (
                      <Moon stroke="#fff" width={24} height={24} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setIsSettingsModalVisible(true)}>
                  <Settings stroke="#fff" width={24} height={24} />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {/* --- UPLOAD BUTTONS --- */}
          <View style={styles.uploadContainer}>
            <TouchableOpacity
                style={[styles.uploadButton, darkMode && styles.darkUploadButton]}
                onPress={pickDocument}
                disabled={isLoading}
            >
              <Book stroke={darkMode ? "#fff" : "#fff"} width={24} height={24} />
              <Text style={styles.uploadButtonText}>Upload PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.uploadButton, darkMode && styles.darkUploadButton]}
                onPress={pickImageFromCamera}
                disabled={isLoading}
            >
              <Camera stroke={darkMode ? "#fff" : "#fff"} width={24} height={24} />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          {filePath && (
              <Text style={[styles.fileName, darkMode && styles.darkText]}>
                <FileText stroke={darkMode ? "#4dabf7" : "#007bff"} width={16} height={16} />
                {" " + filePath.split("/").pop()}
              </Text>
          )}

          {/* --- VIEW MODE TOGGLES --- */}
          <View style={styles.viewModeButtons}>
            <TouchableOpacity
                style={[
                  styles.viewModeButton,
                  currentView === "actual" && styles.viewModeButtonActive,
                  darkMode && styles.darkViewModeButton,
                  currentView === "actual" && darkMode && styles.darkViewModeButtonActive,
                ]}
                onPress={() => setCurrentView("actual")}
                disabled={isLoading || !extractedText}
            >
              <Text
                  style={[
                    styles.viewModeButtonText,
                    currentView === "actual" && styles.viewModeButtonTextActive,
                    darkMode && styles.darkViewModeText,
                  ]}
              >
                Original
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                  styles.viewModeButton,
                  currentView === "simplified" && styles.viewModeButtonActive,
                  darkMode && styles.darkViewModeButton,
                  currentView === "simplified" && darkMode && styles.darkViewModeButtonActive,
                ]}
                onPress={() => processText("simplified")}
                disabled={isLoading || !extractedText}
            >
              <Text
                  style={[
                    styles.viewModeButtonText,
                    currentView === "simplified" && styles.viewModeButtonTextActive,
                    darkMode && styles.darkViewModeText,
                  ]}
              >
                Simplified
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                  styles.viewModeButton,
                  currentView === "summary" && styles.viewModeButtonActive,
                  darkMode && styles.darkViewModeButton,
                  currentView === "summary" && darkMode && styles.darkViewModeButtonActive,
                ]}
                onPress={() => processText("summary")}
                disabled={isLoading || !extractedText}
            >
              <Text
                  style={[
                    styles.viewModeButtonText,
                    currentView === "summary" && styles.viewModeButtonTextActive,
                    darkMode && styles.darkViewModeText,
                  ]}
              >
                Summary
              </Text>
            </TouchableOpacity>
          </View>

          {/* --- LOADING INDICATOR --- */}
          {isLoading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={darkMode ? "#4dabf7" : "#007bff"} />
                <Text style={[styles.loadingText, darkMode && styles.darkText]}>Processing...</Text>
              </View>
          ) : (
              // --- CONTENT AND ACTION BUTTONS ---
              <ScrollView
                  style={[styles.contentScrollView, darkMode && styles.darkContentScrollView]}
                  contentContainerStyle={{ paddingBottom: 60 }}
              >
                {imageUrls.map((url, index) => (
                    <Image key={index} source={{ uri: url }} style={styles.contentImage} resizeMode="contain" />
                ))}
                <Text style={dynamicTextStyle}>{textToDisplay}</Text>

                {/* --- ACTION BUTTONS CONTAINER --- */}
                {textToDisplay.trim().length > 0 && (
                    <View style={styles.bottomActionsContainer}>
                      <TouchableOpacity
                          style={[styles.bottomActionButton, darkMode && styles.darkBottomActionButton]}
                          onPress={() => speakText(textToDisplay)}
                      >
                        <Volume2 stroke={darkMode ? "#fff" : "#fff"} width={20} height={20} />
                        <Text style={styles.bottomActionButtonText}>Listen</Text>
                      </TouchableOpacity>

                      {currentView !== "summary" && (
                          <TouchableOpacity
                              style={[styles.bottomActionButton, darkMode && styles.darkBottomActionButton]}
                              onPress={generateQuiz}
                          >
                            <HelpCircle stroke={darkMode ? "#fff" : "#fff"} width={20} height={20} />
                            <Text style={styles.bottomActionButtonText}>Quiz</Text>
                          </TouchableOpacity>
                      )}

                      <TouchableOpacity
                          style={[styles.bottomActionButton, darkMode && styles.darkBottomActionButton]}
                          onPress={printToPdf}
                      >
                        <Printer stroke={darkMode ? "#fff" : "#fff"} width={20} height={20} />
                        <Text style={styles.bottomActionButtonText}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                )}
              </ScrollView>
          )}
        </View>
      </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F2F6",
  },
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F0F2F6",
  },
  darkBackground: {
    backgroundColor: "#121212",
  },
  darkText: {
    color: "#E0E0E0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F2F6",
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: 300,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: "OpenDyslexic",
    color: "#333",
  },
  header: {
    width: "100%",
    paddingTop: Platform.OS === "ios" ? 0 : StatusBar.currentHeight,
    paddingBottom: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "OpenDyslexic",
    color: "white",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 8,
    marginLeft: 10,
  },
  uploadContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "90%",
    marginTop: 20,
    marginBottom: 15,
  },
  uploadButton: {
    backgroundColor: "#007bff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  darkUploadButton: {
    backgroundColor: "#1e88e5",
  },
  uploadButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "OpenDyslexic",
    marginLeft: 8,
  },
  fileName: {
    fontSize: 14,
    marginBottom: 15,
    fontFamily: "OpenDyslexic-Regular",
    color: "#555",
    flexDirection: "row",
    alignItems: "center",
  },
  viewModeButtons: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e9ecef",
  },
  viewModeButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#e9ecef",
  },
  darkViewModeButton: {
    backgroundColor: "#333",
  },
  viewModeButtonActive: {
    backgroundColor: "#007bff",
  },
  darkViewModeButtonActive: {
    backgroundColor: "#1e88e5",
  },
  viewModeButtonText: {
    color: "#333",
    fontFamily: "OpenDyslexic-Regular",
    fontSize: 14,
  },
  darkViewModeText: {
    color: "#e0e0e0",
  },
  viewModeButtonTextActive: {
    color: "white",
    fontWeight: "bold",
  },
  contentScrollView: {
    flex: 1,
    width: "90%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  darkContentScrollView: {
    backgroundColor: "#1e1e1e",
    borderColor: "#333",
  },
  contentImage: {
    width: "100%",
    height: 200,
    marginBottom: 15,
    borderRadius: 8,
  },
  bottomActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 25,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 20,
    marginBottom: 10,
  },
  bottomActionButton: {
    backgroundColor: "#1A237E",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    flexDirection: "row",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  darkBottomActionButton: {
    backgroundColor: "#303F9F",
  },
  bottomActionButtonText: {
    color: "white",
    fontSize: 15,
    fontFamily: "OpenDyslexic",
    fontWeight: "bold",
    marginLeft: 8,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "85%",
    maxWidth: 500,
  },
  darkModalView: {
    backgroundColor: "#1e1e1e",
    borderColor: "#333",
  },
  settingsModalView: {
    maxHeight: "80%",
  },
  quizModalView: {
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "OpenDyslexic",
    color: "#333",
    textAlign: "center",
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontFamily: "OpenDyslexic-Regular",
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    fontFamily: "OpenDyslexic-Regular",
    fontSize: 16,
  },
  darkInput: {
    borderColor: "#555",
    backgroundColor: "#333",
    color: "#e0e0e0",
  },
  colorInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    fontFamily: "OpenDyslexic-Regular",
    marginRight: 10,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: "OpenDyslexic-Regular",
    marginBottom: 8,
    color: "#333",
    flex: 1,
  },
  slider: {
    flex: 2,
    height: 40,
  },
  toggleButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginLeft: 10,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 10,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    elevation: 2,
    marginHorizontal: 5,
    minWidth: 120,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
  },
  submitButton: {
    backgroundColor: "#4CAF50",
  },
  cancelButton: {
    backgroundColor: "#f44336",
  },
  closeButton: {
    backgroundColor: "#2196F3",
    marginTop: 15,
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    fontFamily: "OpenDyslexic",
    fontSize: 14,
  },
  quizScrollView: {
    maxHeight: "60%",
    width: "100%",
    marginBottom: 20,
  },
  quizQuestionContainer: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  quizQuestionText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    fontFamily: "OpenDyslexic",
    color: "#333",
  },
  quizOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  darkQuizOption: {
    backgroundColor: "#333",
  },
  selectedOption: {
    backgroundColor: "#e3f2fd",
  },
  darkSelectedOption: {
    backgroundColor: "#1e3a5f",
  },
  radioButton: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#007bff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  darkRadioButton: {
    borderColor: "#4dabf7",
  },
  radioButtonInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: "#007bff",
  },
  darkRadioButtonInner: {
    backgroundColor: "#4dabf7",
  },
  quizOptionText: {
    fontSize: 15,
    fontFamily: "OpenDyslexic-Regular",
    color: "#333",
    flex: 1,
  },
  quizActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 10,
  },
})
