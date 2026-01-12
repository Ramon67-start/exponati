import { View, Text, StyleSheet, TouchableOpacity, Platform, useColorScheme, StatusBar, Linking, ScrollView, Clipboard, TextInput, KeyboardAvoidingView, ActivityIndicator, Modal, Share, Pressable } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useCallback, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { Copy, Check, X, Minimize2, Send, Menu, FileText, Share2, Volume2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSettings } from '@/contexts/SettingsContext';
import { getTranslation } from '@/constants/translations';
import { useLauncher } from '@/contexts/LauncherContext';
import { ChatMessage as ChatMessageType, Note } from '@/types';
import * as Speech from 'expo-speech';
import CustomAlert from './CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { executeVoiceCommand, normalizeTextForCommands } from '@/utils/voiceCommands';
import ChatMessageComponent from './ChatMessage';
import { commandStateManager } from '@/utils/commandState';
import { executeCommand } from '@/utils/commandExecutor';
import { getParameterQuestion } from '@/utils/commandValidator';
import { processEnhancedVoiceCommand } from '@/utils/enhancedCommandIntegration';
import { useVoiceCallbacks } from '@/hooks/useVoiceCallbacks';


export interface ChatPageRef {
  setInputAndSend: (text: string) => void;
  startAutoListening?: () => void;
  addCommandMessage: (userText: string, responseText: string) => void;
  sendMessageFromVoice?: (text: string) => void;
}

interface ChatApp {
  id: string;
  name: string;
  icon: string;
  iosScheme?: string;
  androidScheme?: string;
  webUrl?: string;
}

const AVAILABLE_CHAT_APPS: ChatApp[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: '🤖',
    iosScheme: 'chatgpt://',
    androidScheme: 'com.openai.chatgpt',
    webUrl: 'https://chat.openai.com',
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '🧠',
    webUrl: 'https://claude.ai',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '✨',
    iosScheme: 'googlegemini://',
    androidScheme: 'com.google.android.apps.bard',
    webUrl: 'https://gemini.google.com',
  },
  {
    id: 'copilot',
    name: 'Copilot',
    icon: '💬',
    iosScheme: 'ms-copilot://',
    androidScheme: 'com.microsoft.copilot',
    webUrl: 'https://copilot.microsoft.com',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    icon: '🔍',
    webUrl: 'https://www.perplexity.ai',
  },
];

const OPENROUTER_API_KEY = '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';

const FREE_AI_MODELS = [
  'openai/gpt-3.5-turbo',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-coder',
];

const DEFAULT_MODEL = FREE_AI_MODELS[1];

const ChatPage = forwardRef<ChatPageRef, Record<string, never>>((props, ref) => {
  const { settings, updateSettings } = useSettings();
  const t = (key: string) => getTranslation(settings.appLanguage, key as any);
  const { addNote, tags, addToList, notes, updateNote } = useLauncher();
  const { callbacks } = useVoiceCallbacks(settings.appLanguage || 'ca-ES');
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [useWebView, setUseWebView] = useState(false);
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [input, setInput] = useState('');
  const webViewRef = useRef<WebView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const colorScheme = useColorScheme();
  const isDarkMode = settings.darkMode === 'system' ? (colorScheme === 'dark') : settings.darkMode;
  const insets = useSafeAreaInsets();

  const selectedAppId = settings.preferredChatApp || 'chatgpt';
  const selectedApp = AVAILABLE_CHAT_APPS.find(app => app.id === selectedAppId) || AVAILABLE_CHAT_APPS[0];

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [waitingForCommandResponse, setWaitingForCommandResponse] = useState<{ command: string; type: string } | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      Speech.stop();
      setSpeakingMessageId(null);
      setInput('');
      setTranscribedText('');
      setError(null);
      inputRef.current?.blur();
    };
  }, []);

  // Inject addCommandMessage into callbacks
  useEffect(() => {
    callbacks.addChatMessage = (userText: string, responseText: string) => {
      const userMessage: ChatMessageType = {
        id: Date.now().toString(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
      };
      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        isCommandFeedback: true,
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
    };
  }, [callbacks]);

  const openChatApp = useCallback(async (app: ChatApp) => {
    try {
      let urlToOpen = '';

      if (Platform.OS === 'ios' && app.iosScheme) {
        urlToOpen = app.iosScheme;
      } else if (Platform.OS === 'android' && app.androidScheme) {
        urlToOpen = `intent://#Intent;package=${app.androidScheme};end`;
      } else if (app.webUrl) {
        urlToOpen = app.webUrl;
      }

      if (!urlToOpen) {
        showAlert(
          t('error'),
          `${app.name} ${t('notAvailable').toLowerCase()}.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      const canOpen = await Linking.canOpenURL(urlToOpen);
      
      if (canOpen) {
        await Linking.openURL(urlToOpen);
      } else {
        if (app.webUrl) {
          await Linking.openURL(app.webUrl);
        } else {
          showAlert(
            t('error'),
            t('couldNotOpenApp').replace('{name}', app.name),
            [{ text: 'OK', style: 'default' }]
          );
        }
      }
    } catch (error) {
      console.error('Error opening chat app:', error);
      showAlert(
        t('error'),
        t('couldNotOpenApp').replace('{name}', app.name),
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, []);

  const selectChatApp = useCallback((appId: string) => {
    updateSettings({ preferredChatApp: appId });
  }, [updateSettings]);

  const getBackgroundColor = useCallback(() => {
    if (settings.screenBackgroundColor) {
      return settings.screenBackgroundColor;
    }
    return isDarkMode ? Colors.dark.background : '#f5f5f5';
  }, [settings.screenBackgroundColor, isDarkMode]);

  const getStatusBarStyle = useCallback(() => {
    const bgColor = getBackgroundColor();
    if (bgColor === '#000000' || bgColor === Colors.dark.background) {
      return 'light-content';
    }
    return isDarkMode ? 'light-content' : 'dark-content';
  }, [getBackgroundColor, isDarkMode]);

  const backgroundColor = getBackgroundColor();

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(backgroundColor);
    }
  }, [backgroundColor]);

  const copyToClipboard = useCallback(async () => {
    if (transcribedText) {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(transcribedText);
      } else {
        Clipboard.setString(transcribedText);
      }
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  }, [transcribedText]);

  const dismissTranscription = useCallback(() => {
    setTranscribedText('');
    setIsCopied(false);
  }, []);

  const detectFutureDate = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    const currentYear = 2025;
    const knowledgeCutoffDate = new Date('2023-11-01');
    
    const futureYearRegex = /(202[4-9]|20[3-9]\d|2[1-9]\d{2})/;
    const yearMatch = text.match(futureYearRegex);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year > 2023) {
        console.log('Detected future year:', year);
        return true;
      }
    }
    
    const futureIndicators = [
      'després de novembre de 2023',
      'després de 2023',
      'després del 2023',
      'en 2024',
      'el 2024',
      'en 2025',
      'el 2025',
      'en 2026',
      'el 2026',
      'després de novembre',
      'despres de novembre de 2023',
      'despres de 2023',
      'despres del 2023',
      'después de noviembre de 2023',
      'después de 2023',
      'después del 2023',
      'en 2024',
      'en 2025',
      'en 2026',
      'after november 2023',
      'after 2023',
      'in 2024',
      'in 2025',
      'in 2026',
    ];
    
    for (const indicator of futureIndicators) {
      if (lowerText.includes(indicator)) {
        console.log('Detected future date indicator:', indicator);
        return true;
      }
    }
    
    return false;
  };

  const speakText = useCallback(async (text: string) => {
    const langCode = settings.speechLanguage?.split('-')[0] || 'ca';
    Speech.speak(text, {
      language: langCode,
      rate: settings.ttsVoiceSpeed || 1.0,
    });
  }, [settings.speechLanguage, settings.ttsVoiceSpeed]);

  const addCommandMessage = useCallback((userText: string, responseText: string) => {
    console.log('💬 addCommandMessage called!');
    console.log('💬 User text:', userText);
    console.log('💬 Response text:', responseText);
    
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };
    const assistantMessage: ChatMessageType = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText,
      timestamp: Date.now(),
      isCommandFeedback: true,
    };
    
    console.log('💬 Creating messages:', { userMessage, assistantMessage });
    setMessages(prev => {
      const newMessages = [...prev, userMessage, assistantMessage];
      console.log('💬 Messages state updated! Total messages:', newMessages.length);
      return newMessages;
    });
    
    // Check if response asks for more info
    const needsMoreInfo = 
      responseText.includes('Què s\'ha d\'anotar?') ||
      responseText.includes('Què s\'ha d\'afegir?') ||
      responseText.includes('Què s\'ha de crear?') ||
      responseText.includes('Què s\'ha d\'inserir?') ||
      responseText.includes('¿Qué hay que apuntar?') ||
      responseText.includes('¿Qué hay que añadir?') ||
      responseText.includes('¿Qué hay que crear?') ||
      responseText.includes('¿Qué hay que insertar?') ||
      responseText.includes('What should I note?') ||
      responseText.includes('What should I add?') ||
      responseText.includes('What should I create?') ||
      responseText.includes('What should I insert?');
    
    if (needsMoreInfo) {
      console.log('💬 Command needs more info - activating response mode');
      let commandType = 'apunta';
      if (userText.toLowerCase().includes('afegeix') || userText.toLowerCase().includes('añade')) {
        commandType = 'afegeix';
      } else if (userText.toLowerCase().includes('crea') || userText.toLowerCase().includes('crear')) {
        commandType = 'crea';
      } else if (userText.toLowerCase().includes('insereix') || userText.toLowerCase().includes('insertar')) {
        commandType = 'insereix';
      }
      setWaitingForCommandResponse({ command: userText, type: commandType });
    }
  }, []);

  const handleSendMessage = useCallback(async (directText?: string, fromVoice: boolean = false) => {
    const messageText = directText || input.trim() || transcribedText.trim();
    if (!messageText) return;
    if (isSending) return;
    
    console.log('handleSendMessage called with:', messageText);
    console.log('Message from voice:', fromVoice);
    
    // Clear inputs immediately
    setInput('');
    setTranscribedText('');
    
    // ========== PRIORITY 1: Check if there's an active command waiting for parameters ==========
    if (commandStateManager.hasActiveCommand()) {
      console.log('🎯 Active command detected, processing as parameter');
      
      // ✅ NOMÉS normalitzar si ve de veu
      const textForCommandDetection = fromVoice 
        ? normalizeTextForCommands(messageText)
        : messageText;
      
      console.log('Original text:', messageText);
      console.log('Text for detection:', textForCommandDetection);
      
      const result = await processEnhancedVoiceCommand(
        textForCommandDetection,
        settings.appLanguage || 'ca-ES',
        speakText
      );
      
      if (result.handled) {
        // Show user input with ORIGINAL text
        const userMessage: ChatMessageType = {
          id: Date.now().toString(),
          role: 'user',
          content: messageText,  // ← TEXT ORIGINAL
          timestamp: Date.now(),
          isPrivateParam: true,
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Show response
        if (result.needsParameters && result.question) {
          const questionMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: result.question,
            timestamp: Date.now(),
            isCommandFeedback: true,
            commandMode: true,
          };
          setMessages(prev => [...prev, questionMessage]);
        } else if (result.success && result.message) {
          const successMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: result.message,
            timestamp: Date.now(),
            isCommandFeedback: true,
          };
          setMessages(prev => [...prev, successMessage]);
        } else if (result.error) {
          const errorMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: result.error,
            timestamp: Date.now(),
            isCommandFeedback: true,
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        
        return; // ❌ DO NOT send to OpenRouter
      }
    }
    
    // ========== PRIORITY 2: Try NEW enhanced command system first ==========
    // ✅ NOMÉS normalitzar si ve de veu
    const textForCommandDetection = fromVoice 
      ? normalizeTextForCommands(messageText)
      : messageText;
    
    console.log('Original text:', messageText);
    console.log('Text for detection:', textForCommandDetection);
    
    const enhancedResult = await processEnhancedVoiceCommand(
      textForCommandDetection,
      settings.appLanguage || 'ca-ES',
      speakText
    );
    
    if (enhancedResult.handled) {
      console.log('✅ Enhanced command system handled the input');
      
      if (enhancedResult.needsParameters && enhancedResult.question) {
        addCommandMessage(messageText, enhancedResult.question);  // ← TEXT ORIGINAL
      } else if (enhancedResult.success && enhancedResult.message) {
        addCommandMessage(messageText, enhancedResult.message);  // ← TEXT ORIGINAL
      } else if (enhancedResult.error) {
        addCommandMessage(messageText, enhancedResult.error);  // ← TEXT ORIGINAL
      }
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      return; // ❌ DO NOT send to OpenRouter
    }
    
    // ========== PRIORITY 3: Fallback to OLD command system (for backward compatibility) ==========
    console.log('Checking if command:', textForCommandDetection);
    
    let isCommand = false;
    if (settings.launcherMode !== 'basic') {
      isCommand = await executeVoiceCommand(
        textForCommandDetection,  // ← Usar text normalitzat només si fromVoice=true
        () => {},
        settings.customVoiceCommands,
        settings.appLanguage || 'ca-ES',
        undefined,
        undefined,
        tags,
        settings.weatherLocation,
        addCommandMessage,
        undefined,
        undefined,
        addToList,
        notes,
        undefined, // speakText
        undefined, // activateMicrophone
        undefined, // waitForConfirmation
        updateNote
      );
    }
    
    console.log('Command execution result (old system):', isCommand);
    
    if (isCommand) {
      console.log('Command was executed, messages should be added to chat via addCommandMessage');
      // Wait a bit to ensure messages are added
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return; // ❌ DO NOT send to OpenRouter
    }
    
    // ========== PRIORITY 4: Check for future dates (before sending to AI) ==========
    if (detectFutureDate(messageText)) {
      console.log('Detected question about future date, opening browser search');
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(messageText)}`;
      try {
        await Linking.openURL(searchUrl);
        setInput('');
        setTranscribedText('');
      } catch (error) {
        console.error('Error opening search:', error);
      }
      return;
    }
    
    // ========== PRIORITY 5: Not a command - send to OpenRouter AI ==========
    if (!OPENROUTER_API_KEY) {
      console.log('No API key, searching web instead');
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(messageText)}`;
      try {
        await Linking.openURL(searchUrl);
      } catch (error) {
        console.error('Error opening search:', error);
      }
      return;
    }
    console.log('Sending message to OpenRouter:', messageText);
    
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setTranscribedText('');
    setIsSending(true);
    setError(null);
    
    const languageNames: { [key: string]: string } = {
      'ca-ES': 'Catalan',
      'es-ES': 'Spanish',
      'en-US': 'English',
    };
    const languageName = languageNames[settings.appLanguage] || 'Catalan';
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.preferredAIModel || DEFAULT_MODEL,
          messages: [
            { role: 'system', content: `You are a helpful assistant. Always respond in ${languageName}, regardless of the language of the user's input. Your knowledge cutoff date is November 2023. If a user asks about events or information after November 2023, politely inform them that your knowledge is limited and suggest they search online for current information.` },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: messageText },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenRouter error:', errorData);
        throw new Error(errorData.error?.message || 'Error al comunicar amb OpenRouter');
      }

      const data = await response.json();
      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.choices[0]?.message?.content || 'No hi ha resposta',
        timestamp: Date.now(),
      };
      
      const responseText = assistantMessage.content.toLowerCase();
      const isUnsureResponse = 
        responseText.includes('no tinc informació') ||
        responseText.includes('no puc ajudar') ||
        responseText.includes('no sé') ||
        responseText.includes('no estic segur') ||
        responseText.includes('no disposo') ||
        responseText.includes('no tinc accés') ||
        responseText.includes("i don't have") ||
        responseText.includes("i can't") ||
        responseText.includes("i don't know") ||
        responseText.includes("i'm not sure") ||
        responseText.includes('no tengo información') ||
        responseText.includes('no puedo ayudar') ||
        responseText.includes('no sé') ||
        responseText.includes('no estoy segur');
      
      if (isUnsureResponse) {
        console.log('AI cannot answer properly, opening web search instead');
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(messageText)}`;
        try {
          await Linking.openURL(searchUrl);
          setMessages(prev => prev.slice(0, -1));
          setIsSending(false);
          return;
        } catch (error) {
          console.error('Error opening search:', error);
        }
      }
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (settings.chatVoiceResponseEnabled && fromVoice) {
        setTimeout(() => {
          Speech.stop();
          setSpeakingMessageId(assistantMessage.id);
          Speech.speak(assistantMessage.content, {
            language: settings.speechLanguage || 'ca-ES',
            rate: settings.ttsVoiceSpeed || 1.0,
            onDone: () => setSpeakingMessageId(null),
            onStopped: () => setSpeakingMessageId(null),
            onError: () => setSpeakingMessageId(null),
          });
        }, 300);
      }
    } catch (err) {
      console.error('Error sending message, opening web search instead:', err);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(messageText)}`;
      try {
        await Linking.openURL(searchUrl);
        setMessages(prev => prev.slice(0, -1));
      } catch (searchError) {
        console.error('Error opening search:', searchError);
        const errorMessage = err instanceof Error ? err.message : 'Error desconegut';
        setError(errorMessage);
        showAlert('Error', `No s'ha pogut enviar el missatge: ${errorMessage}`, [
          { text: 'OK', style: 'default' }
        ]);
      }
    } finally {
      setIsSending(false);
    }
  }, [input, transcribedText, isSending, messages, settings.preferredAIModel, settings.appLanguage, settings.chatVoiceResponseEnabled, settings.speechLanguage, settings.ttsVoiceSpeed, settings.customVoiceCommands, settings.launcherMode, tags, settings.weatherLocation, addToList, notes, speakText, addCommandMessage, updateNote]);

  useImperativeHandle(ref, () => ({
    setInputAndSend: (text: string) => {
      console.log('Voice transcription received:', text);
      if (useWebView) {
        setTranscribedText(text);
      } else {
        setTranscribedText('');
        setInput('');
        handleSendMessage(text, true);  // true because it comes from setInputAndSend (voice)
      }
    },
    startAutoListening: undefined,
    addCommandMessage,
    sendMessageFromVoice: (text: string) => {
      handleSendMessage(text, true);  // fromVoice = true
    },
  }), [useWebView, handleSendMessage, addCommandMessage]);

  const renderOpenRouterChat = () => (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 50 : 0}
    >
      <View style={{ flex: 1, backgroundColor }}>
        <View style={[styles.webViewHeader, { paddingTop: insets.top + 10, backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff' }]}>
          <Text style={[styles.webViewTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>🤖 {t('Laia')}</Text>
          <View style={styles.webViewHeaderActions}>
            <TouchableOpacity
              onPress={() => setShowChatSelector(true)}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Menu size={22} color={isDarkMode ? Colors.dark.primary : '#007AFF'} />
            </TouchableOpacity>
          </View>
        </View>
        
        <ScrollView 
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.messagesContainer, { paddingBottom: insets.bottom + 80 }]}
        >
          {messages.length === 0 && (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateText, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>
                {t('writeMessage')}
              </Text>
            </View>
          )}
          {messages.map((m) => (
            <View key={m.id} style={styles.messageRow}>
              <View style={[
                styles.messageBubble,
                m.role === 'user' 
                  ? [styles.userBubble, { backgroundColor: isDarkMode ? Colors.dark.primary : '#007AFF' }]
                  : [styles.assistantBubble, { backgroundColor: isDarkMode ? Colors.dark.surface : '#f0f0f0' }]
              ]}>
                {m.role === 'user' ? (
                  <Text style={[styles.messageText, { color: '#ffffff' }]}>
                    {m.content}
                  </Text>
                ) : (
                  <ChatMessageComponent text={m.content} isUser={false} />
                )}
              </View>
              {m.role === 'assistant' && (
                <View style={styles.messageActions}>
                  <TouchableOpacity
                    style={styles.messageActionButton}
                    onPress={() => {
                      const newNote: Note = {
                        id: Date.now().toString(),
                        content: m.content,
                        createdAt: Date.now(),
                        type: 'note',
                        backgroundColor: settings.noteBackgroundColor || '#D4E5FF',
                      };
                      addNote(newNote);
                      showAlert(t('note'), t('noteCreated'), [
                        { text: 'OK', style: 'default' }
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <FileText size={18} color={isDarkMode ? Colors.dark.primary : '#007AFF'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.messageActionButton}
                    onPress={async () => {
                      try {
                        await Share.share({ message: m.content });
                      } catch (error) {
                        console.error('Error sharing message:', error);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Share2 size={18} color={isDarkMode ? Colors.dark.primary : '#007AFF'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.messageActionButton}
                    onPress={() => {
                      if (speakingMessageId === m.id) {
                        Speech.stop();
                        setSpeakingMessageId(null);
                      } else {
                        Speech.stop();
                        setSpeakingMessageId(m.id);
                        Speech.speak(m.content, {
                          language: settings.speechLanguage || 'ca-ES',
                          onDone: () => setSpeakingMessageId(null),
                          onStopped: () => setSpeakingMessageId(null),
                          onError: () => setSpeakingMessageId(null),
                        });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Volume2 
                      size={18} 
                      color={speakingMessageId === m.id ? '#4CAF50' : (isDarkMode ? Colors.dark.primary : '#007AFF')} 
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          {isSending && (
            <View style={styles.messageRow}>
              <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: isDarkMode ? Colors.dark.surface : '#f0f0f0' }]}>
                <ActivityIndicator size="small" color={isDarkMode ? Colors.dark.primary : '#007AFF'} />
              </View>
            </View>
          )}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {error}</Text>
            </View>
          )}
        </ScrollView>
        
        <View style={[styles.inputContainer, { 
          backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff',
        }]}>
          <TextInput
            style={[styles.input, { 
              color: isDarkMode ? Colors.dark.text : '#1a1a1a',
              backgroundColor: isDarkMode ? Colors.dark.background : '#f0f0f0',
            }]}
            placeholder={t('writeMessage')}
            placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : '#999'}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            ref={inputRef}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onSubmitEditing={() => {
              if (input.trim() || transcribedText.trim()) {
                handleSendMessage();
              }
            }}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: isDarkMode ? Colors.dark.primary : '#007AFF' },
              (!input.trim() && !transcribedText.trim()) && { opacity: 0.5 }
            ]}
            onPress={() => handleSendMessage()}
            disabled={!input.trim() && !transcribedText.trim()}
            activeOpacity={0.7}
          >
            <Send size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const renderChatSelectorModal = () => (
    <Modal
      visible={showChatSelector}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowChatSelector(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
              {t('selectChat')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowChatSelector(false)}
              style={styles.modalCloseButton}
              activeOpacity={0.7}
            >
              <X size={24} color={isDarkMode ? Colors.dark.textSecondary : '#666'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            <TouchableOpacity
              style={[
                styles.modalOption,
                !useWebView && {
                  backgroundColor: isDarkMode ? Colors.dark.primary + '20' : '#007AFF20',
                  borderColor: isDarkMode ? Colors.dark.primary : '#007AFF',
                  borderWidth: 2,
                }
              ]}
              onPress={() => {
                setUseWebView(false);
                setShowChatSelector(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalOptionIcon}>🤖</Text>
              <View style={styles.modalOptionInfo}>
                <Text style={[styles.modalOptionName, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                  Laia
                </Text>
                <Text style={[styles.modalOptionDesc, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>
                  {t('directChatWithAI')}
                </Text>
              </View>
              {!useWebView && (
                <Text style={[styles.selectedIndicator, { color: isDarkMode ? Colors.dark.primary : '#007AFF' }]}>
                  ✓
                </Text>
              )}
            </TouchableOpacity>

            <View style={[styles.modalSeparator, { backgroundColor: isDarkMode ? Colors.dark.border : '#e0e0e0' }]} />

            {AVAILABLE_CHAT_APPS.map((app) => (
              <TouchableOpacity
                key={app.id}
                style={[
                  styles.modalOption,
                  useWebView && app.id === selectedAppId && {
                    backgroundColor: isDarkMode ? Colors.dark.primary + '20' : '#007AFF20',
                    borderColor: isDarkMode ? Colors.dark.primary : '#007AFF',
                    borderWidth: 2,
                  }
                ]}
                onPress={() => {
                  setUseWebView(true);
                  selectChatApp(app.id);
                  setShowChatSelector(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalOptionIcon}>{app.icon}</Text>
                <View style={styles.modalOptionInfo}>
                  <Text style={[styles.modalOptionName, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                    {app.name}
                  </Text>
                  <Text style={[styles.modalOptionDesc, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>
                    {t('openInWebView')}
                  </Text>
                </View>
                {useWebView && app.id === selectedAppId && (
                  <Text style={[styles.selectedIndicator, { color: isDarkMode ? Colors.dark.primary : '#007AFF' }]}>
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <View style={{ flex: 1, backgroundColor }}>
      <StatusBar
        barStyle={getStatusBarStyle()}
        backgroundColor="transparent"
        translucent
      />
      {renderChatSelectorModal()}
      {useWebView && selectedApp.webUrl ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.webViewHeader, { paddingTop: insets.top + 10, backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff' }]}>
            <Text style={[styles.webViewTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
              {selectedApp.icon} {selectedApp.name}
            </Text>
            {settings.launcherMode !== 'basic' && (
              <View style={styles.webViewHeaderActions}>
                <TouchableOpacity
                  onPress={() => webViewRef.current?.reload()}
                  style={styles.headerButton}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.headerButtonText, { color: isDarkMode ? Colors.dark.primary : '#007AFF' }]}>⟳</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setUseWebView(false)}
                  style={styles.headerButton}
                  activeOpacity={0.7}
                >
                  <Minimize2 size={20} color={isDarkMode ? Colors.dark.textSecondary : '#666'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowChatSelector(true)}
                  style={styles.headerButton}
                  activeOpacity={0.7}
                >
                  <Menu size={22} color={isDarkMode ? Colors.dark.primary : '#007AFF'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: selectedApp.webUrl }}
            style={{ flex: 1 }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error:', nativeEvent);
              showAlert(t('error'), t('couldNotLoadChat'), [
                { text: 'OK', style: 'default' }
              ]);
            }}
          />
          {transcribedText ? (
            <View style={[styles.transcriptionBanner, { backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff' }]}>
              <View style={styles.transcriptionContent}>
                <Text style={[styles.transcriptionLabel, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>
                  {t('transcription')}:
                </Text>
                <Text style={[styles.transcriptionTextBanner, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]} numberOfLines={2}>
                  {transcribedText}
                </Text>
              </View>
              <View style={styles.transcriptionActions}>
                <TouchableOpacity
                  onPress={copyToClipboard}
                  style={[styles.bannerButton, { backgroundColor: isCopied ? '#4CAF50' : (isDarkMode ? Colors.dark.primary : '#007AFF') }]}
                  activeOpacity={0.7}
                >
                  {isCopied ? (
                    <Check size={18} color="#ffffff" />
                  ) : (
                    <Copy size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={dismissTranscription}
                  style={[styles.bannerButton, { backgroundColor: isDarkMode ? Colors.dark.border : '#e0e0e0' }]}
                  activeOpacity={0.7}
                >
                  <X size={18} color={isDarkMode ? Colors.dark.text : '#1a1a1a'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        renderOpenRouterChat()
      )}
      </View>
      {alertConfig && (
        <CustomAlert
          visible={!!alertConfig}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={hideAlert}
        />
      )}
    </>
  );
});

ChatPage.displayName = 'ChatPage';

export default ChatPage;

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  webViewHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 24,
    fontWeight: '600' as const,
  },
  transcriptionBanner: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  transcriptionContent: {
    flex: 1,
    gap: 4,
  },
  transcriptionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptionTextBanner: {
    fontSize: 15,
    lineHeight: 20,
  },
  transcriptionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bannerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  webViewToggleContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  webViewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  webViewToggleText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  selectedAppContainer: {
    marginBottom: 32,
  },
  selectedAppCard: {
    borderRadius: 16,
    borderWidth: 3,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  appsContainer: {
    marginBottom: 32,
  },
  appCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  appCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  appIcon: {
    fontSize: 32,
  },
  appInfo: {
    flex: 1,
    gap: 4,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  appDescription: {
    fontSize: 14,
  },
  selectedBadge: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  infoContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  messagesContainer: {
    padding: 16,
    gap: 12,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  messageActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  inputContainer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2.5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  modalOptionIcon: {
    fontSize: 32,
  },
  modalOptionInfo: {
    flex: 1,
    gap: 4,
  },
  modalOptionName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalOptionDesc: {
    fontSize: 14,
  },
  selectedIndicator: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  modalSeparator: {
    height: 1,
    marginVertical: 12,
  },
});

export { ChatPage };
