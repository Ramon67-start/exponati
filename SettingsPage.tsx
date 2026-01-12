import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Modal, Image, Alert, Platform, useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import Slider from '@react-native-community/slider';
import { ChevronLeft, MapPin, Volume2, Bell, Moon, RotateCcw, Music, MessageSquare, Image as ImageIcon, Maximize, Palette, Upload, RotateCw, Tag, Clock, Mic, Shield, X, Plus, Edit2, Trash2, Command, Sun, Monitor, Languages, Activity, AlertCircle, Download, Trash, Battery } from 'lucide-react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useSettings } from '@/contexts/SettingsContext';
import { useTranslations } from '@/constants/translations';
import { getVoiceCommands } from '@/utils/voiceCommands';
import { useWhisper } from '@/hooks/useWhisper';
import { loadConfig, setDefaultLanguage, setTranscriptionMode, getDefaultLanguage, getTranscriptionMode } from '@/services/WhisperConfig';
import { modelDownloader } from '@/services/ModelDownloader';
import WhisperSetupScreen from '@/screens/WhisperSetupScreen';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { settings, updateSettings, resetSettings, updateCustomCommand, deleteCustomCommand, addCustomCommand, updateLocationFromCoordinates } = useSettings();
  const { t } = useTranslations(settings.appLanguage || 'ca-ES');
  const colorScheme = useColorScheme();
  const isDarkMode = settings.darkMode === 'system' ? (colorScheme === 'dark') : settings.darkMode;
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState(settings.weatherLocation);
  const [showTTSModal, setShowTTSModal] = useState(false);
  const [ttsUrlInput, setTtsUrlInput] = useState(settings.customTTSUrl || '');
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [backgroundUrlInput, setBackgroundUrlInput] = useState(settings.backgroundImage || '');
  const [showColorModal, setShowColorModal] = useState(false);
  const [showVoiceButtonColorModal, setShowVoiceButtonColorModal] = useState(false);
  const [showScreenBackgroundColorModal, setShowScreenBackgroundColorModal] = useState(false);
  const [screenBackgroundColorInput, setScreenBackgroundColorInput] = useState(settings.screenBackgroundColor || '#000000');
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [voiceButtonColorInput, setVoiceButtonColorInput] = useState(settings.voiceButtonColor);
  const [showPinConfigModal, setShowPinConfigModal] = useState(false);
  const [pinConfigInput, setPinConfigInput] = useState('');
  const [pinConfigAction, setPinConfigAction] = useState<'set' | 'change'>('set');
  const [showCustomCommandsModal, setShowCustomCommandsModal] = useState(false);
  const [showAddCommandModal, setShowAddCommandModal] = useState(false);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [commandName, setCommandName] = useState('');
  const [commandPattern, setCommandPattern] = useState('');
  const [commandAction, setCommandAction] = useState<'open_app' | 'open_url' | 'search' | 'custom'>('open_url');
  const [commandActionData, setCommandActionData] = useState('');
  const [showAppLanguageModal, setShowAppLanguageModal] = useState(false);
  const [showIconStyleModal, setShowIconStyleModal] = useState(false);
  const [tempIconStyle, setTempIconStyle] = useState(settings.iconStyle);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<string | null>(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [showWhisperSetupModal, setShowWhisperSetupModal] = useState(false);
  const [whisperConfig, setWhisperConfig] = useState<any>(null);
  const [whisperLanguage, setWhisperLanguage] = useState('ca');
  const [whisperMode, setWhisperMode] = useState<'post' | 'realtime'>('post');
  const whisper = useWhisper(() => setShowWhisperSetupModal(true));

  const findConflicts = (customPattern: string): string[] => {
    const conflicts: string[] = [];
    const predefinedCommands = getVoiceCommands(settings.appLanguage || 'ca-ES');
    try {
      const customRegex = new RegExp(customPattern, 'i');
      predefinedCommands.forEach((cmd) => {
        const testStrings = [
          cmd.description,
          customPattern,
        ];
        testStrings.forEach(test => {
          if (cmd.pattern.test(test) || customRegex.test(test)) {
            if (!conflicts.includes(cmd.description)) {
              conflicts.push(cmd.description);
            }
          }
        });
      });
    } catch (error) {
      console.error('Error finding conflicts:', error);
    }
    return conflicts;
  };



  useEffect(() => {
    if (Platform.OS !== 'web') {
      if (settings.autoRotateEnabled) {
        ScreenOrientation.unlockAsync();
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
  }, [settings.autoRotateEnabled]);

  useEffect(() => {
    const loadWhisperConfig = async () => {
      const config = await loadConfig();
      setWhisperConfig(config);
      const lang = await getDefaultLanguage();
      setWhisperLanguage(lang);
      const mode = await getTranscriptionMode();
      setWhisperMode(mode);
    };
    loadWhisperConfig();
  }, [whisper.installedModel]);

  const PRESET_BACKGROUNDS = [
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=1080',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1080',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1080',
  ];
  const [colorInput, setColorInput] = useState(settings.accentColor);

  const handleSaveLocation = () => {
    updateSettings({ weatherLocation: locationInput });
    setShowLocationModal(false);
  };

  const handleSaveTTS = () => {
    updateSettings({ customTTSUrl: ttsUrlInput.trim() || undefined });
    setShowTTSModal(false);
  };

  const handleSaveBackground = () => {
    updateSettings({ backgroundImage: backgroundUrlInput.trim() || undefined });
    setShowBackgroundModal(false);
  };

  const pickImageFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permís necessari', 'Necessitem permís per accedir a la galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setPreviewImageUri(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No s\'ha pogut seleccionar la imatge.');
    }
  };

  const confirmGalleryImage = () => {
    if (previewImageUri) {
      updateSettings({ backgroundImage: previewImageUri });
      setBackgroundUrlInput(previewImageUri);
      setPreviewImageUri(null);
      setShowBackgroundModal(false);
    }
  };

  const cancelGalleryImage = () => {
    setPreviewImageUri(null);
  };

  const selectPresetBackground = (url: string) => {
    updateSettings({ backgroundImage: url });
    setBackgroundUrlInput(url);
    setShowBackgroundModal(false);
  };

  const handleSaveColor = () => {
    updateSettings({ accentColor: colorInput });
    setShowColorModal(false);
  };

  const handleSaveVoiceButtonColor = () => {
    updateSettings({ voiceButtonColor: voiceButtonColorInput });
    setShowVoiceButtonColorModal(false);
  };

  const handleSaveScreenBackgroundColor = () => {
    updateSettings({ screenBackgroundColor: screenBackgroundColorInput });
    setShowScreenBackgroundColorModal(false);
  };

  const handleReset = () => {
    resetSettings();
  };

  const handleChangeWhisperModel = () => {
    setShowWhisperSetupModal(true);
  };

  const handleDeleteWhisperModel = async () => {
    if (!whisperConfig?.installedModel) return;
    
    Alert.alert(
      'Eliminar model Whisper',
      `Vols eliminar el model ${whisperConfig.installedModel}? Això alliberarà espai però no podràs usar transcripció offline fins que descarreguis un nou model.`,
      [
        { text: 'Cancel·lar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await modelDownloader.deleteModel(whisperConfig.installedModel);
              await whisper.initializeWhisper();
              const config = await loadConfig();
              setWhisperConfig(config);
            } catch (error) {
              console.error('Error deleting model:', error);
              Alert.alert('Error', 'No s\'ha pogut eliminar el model');
            }
          },
        },
      ]
    );
  };

  const handleChangeWhisperLanguage = async (lang: string) => {
    setWhisperLanguage(lang);
    await setDefaultLanguage(lang);
  };

  const handleChangeWhisperMode = async (mode: 'post' | 'realtime') => {
    setWhisperMode(mode);
    await setTranscriptionMode(mode);
  };

  const checkDeepgramStatus = async () => {
    console.log('=== CHECKING DEEPGRAM STATUS ===');
    setCheckingStatus(true);
    setStatusResult(null);
    
    try {
      console.log('Comprovant connexió amb Deepgram API...');
      
      // Generem un petit fitxer WAV de silenci compatible amb React Native
      const generateSilentWav = () => {
        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const duration = 0.5; // 0.5 segons
        const numSamples = Math.floor(sampleRate * duration);
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = numSamples * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true); // AudioFormat (PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Escrivim silenci (tots 0s)
        for (let i = 0; i < numSamples * blockAlign; i++) {
          view.setUint8(44 + i, 0);
        }

        // Per React Native, convertim l'ArrayBuffer a Uint8Array
        const uint8Array = new Uint8Array(buffer);
        
        // Si estem en Web, podem crear un Blob directament
        if (Platform.OS === 'web') {
          return new Blob([buffer], { type: 'audio/wav' });
        }
        
        // Per React Native, retornem l'Uint8Array directament
        return uint8Array;
      };
      
      const audioData = generateSilentWav();
      console.log('Audio generat:', Platform.OS === 'web' ? (audioData as Blob).size : (audioData as Uint8Array).length, 'bytes');
      
      const testResponse = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=ca', {
        method: 'POST',
        headers: {
          'Authorization': 'Token 59ad90aeda5d3b403adf33aa0037ca2b002ad4ba',
          'X-DG-Project': 'ddf0eb78-b99f-46e8-a30f-1002c5b33976',
          'Content-Type': 'audio/wav',
        },
        body: audioData as any,
      });
      
      console.log('Deepgram response status:', testResponse.status);
      
      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('Deepgram error:', errorText);
        
        if (testResponse.status === 401) {
          setStatusResult(`❌ Error: Clau d'API invàlida\n\nLa clau d'API no és correcta o ha caducat.`);
        } else if (testResponse.status === 403) {
          setStatusResult(`❌ Error: Accés denegat\n\nLa clau d'API no té permisos per utilitzar aquest servei.`);
        } else {
          setStatusResult(`❌ Error ${testResponse.status}\n\n${errorText}`);
        }
        return;
      }
      
      const data = await testResponse.json();
      console.log('Deepgram response:', JSON.stringify(data, null, 2));
      
      const modelName = data.metadata?.model_info?.name || 'nova-2';
      const requestId = data.metadata?.request_id || 'N/A';
      
      setStatusResult(`✅ Deepgram funciona correctament!\n\nModel: ${modelName}\nID de petició: ${requestId.substring(0, 16)}...\n\nLa connexió amb l'API de Deepgram és correcta.`);
    } catch (error: any) {
      console.error('Error checking Deepgram status:', error);
      console.error('Error stack:', error.stack);
      
      let errorMessage = 'Error desconegut al connectar amb Deepgram';
      let errorDetails = '';
      
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Error de xarxa';
        errorDetails = 'No es pot connectar amb l\'API de Deepgram.\n\nPossibles causes:\n• Sense connexió a Internet\n• Firewall o bloqueig de xarxa\n• Deepgram temporalment fora de servei';
      } else if (error.name === 'TypeError') {
        errorMessage = 'Error de tipus';
        errorDetails = error.message;
      } else {
        errorMessage = 'Error inesperat';
        errorDetails = error.message || 'No es poden obtenir més detalls';
      }
      
      setStatusResult(`❌ ${errorMessage}\n\n${errorDetails}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background }]}>
      <View style={[styles.header, { borderBottomColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}
          onPress={onClose}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <ChevronLeft size={28} color={isDarkMode ? Colors.dark.text : Colors.light.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('settings')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('language')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
            </View>
            <View style={styles.languageButtonsContainer}>
              <Text style={[styles.languageLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('ttsLanguage')}</Text>
              <View style={styles.languageButtons}>
                {(['ca-ES', 'es-ES', 'en-US'] as const).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.languageButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                      settings.speechLanguage === lang && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                    ]}
                    onPress={() => updateSettings({ speechLanguage: lang })}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.languageButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                      settings.speechLanguage === lang && { color: '#FFFFFF' },
                    ]}>
                      {lang === 'ca-ES' ? 'CA' : lang === 'es-ES' ? 'ES' : 'EN'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowAppLanguageModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Languages size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('appLanguage')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {settings.appLanguage === 'ca-ES' ? t('catalan') :
                   settings.appLanguage === 'es-ES' ? t('spanish') :
                   settings.appLanguage === 'en-US' ? t('english') : t('catalan')}
                </Text>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('voiceAssistant')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('floatingVoiceButton')}</Text>
            </View>
            <Switch
              value={settings.voiceButtonEnabled}
              onValueChange={(value) => updateSettings({ voiceButtonEnabled: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('voiceButtonSize')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.voiceButtonSize}px</Text>
              </View>
            </View>
          </View>
          <View style={[styles.sliderContainer, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <Slider
              style={styles.slider}
              minimumValue={48}
              maximumValue={96}
              step={4}
              value={settings.voiceButtonSize}
              onValueChange={(value) => updateSettings({ voiceButtonSize: value })}
              minimumTrackTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
              maximumTrackTintColor={isDarkMode ? Colors.dark.border : Colors.light.border}
              thumbTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
            />
          </View>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowVoiceButtonColorModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('voiceButtonColor')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: settings.voiceButtonColor }} />
                  <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.voiceButtonColor}</Text>
                </View>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('voiceButtonOpacity')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{Math.round(settings.voiceButtonOpacity * 100)}%</Text>
              </View>
            </View>
          </View>
          <View style={[styles.sliderContainer, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <Slider
              style={styles.slider}
              minimumValue={0.1}
              maximumValue={1}
              step={0.1}
              value={settings.voiceButtonOpacity}
              onValueChange={(value) => updateSettings({ voiceButtonOpacity: value })}
              minimumTrackTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
              maximumTrackTintColor={isDarkMode ? Colors.dark.border : Colors.light.border}
              thumbTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('autoTranscription')}</Text>
            </View>
            <Switch
              value={settings.autoTranscribe}
              onValueChange={(value) => updateSettings({ autoTranscribe: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingInfo}>
              <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('recordingStopMode')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('recordingStopModeDescription')}</Text>
              </View>
            </View>
            <View style={styles.recordingModeButtons}>
              <TouchableOpacity
                style={[
                  styles.recordingModeButton,
                  { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                  settings.recordingStopMode === 'manual' && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ recordingStopMode: 'manual' })}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.recordingModeButtonText,
                  { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                  settings.recordingStopMode === 'manual' && { color: '#FFFFFF' },
                ]}>
                  {t('manual')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordingModeButton,
                  { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                  settings.recordingStopMode === 'timeout' && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ recordingStopMode: 'timeout' })}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.recordingModeButtonText,
                  { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                  settings.recordingStopMode === 'timeout' && { color: '#FFFFFF' },
                ]}>
                  {t('timeout')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {settings.recordingStopMode === 'timeout' && (
            <>
              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <View style={styles.settingInfo}>
                  <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('timeoutDuration')}</Text>
                    <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.recordingTimeoutSeconds}s</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.sliderContainer, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <Slider
                  style={styles.slider}
                  minimumValue={3}
                  maximumValue={15}
                  step={1}
                  value={settings.recordingTimeoutSeconds}
                  onValueChange={(value) => updateSettings({ recordingTimeoutSeconds: value })}
                  minimumTrackTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
                  maximumTrackTintColor={isDarkMode ? Colors.dark.border : Colors.light.border}
                  thumbTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
                />
              </View>
            </>
          )}

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('holdToRecord')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('holdToRecordDescription')}</Text>
              </View>
            </View>
            <Switch
              value={settings.holdToRecordEnabled}
              onValueChange={(value) => updateSettings({ holdToRecordEnabled: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowCustomCommandsModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Command size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('customCommands')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {settings.customVoiceCommands?.length || 0} {t('commandsConfigured')}
                </Text>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('sttProvider')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingInfo}>
              <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('sttProvider')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('sttProviderDescription')}</Text>
              </View>
            </View>
            <View style={styles.recordingModeButtons}>
              {[
                { value: 'web-speech' as const, label: Platform.OS === 'web' ? t('webSpeech') : t('deviceRecognition') },
                { value: 'app' as const, label: t('appRecognition') },
              ].map((provider) => (
                <TouchableOpacity
                  key={provider.value}
                  style={[
                    styles.recordingModeButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.sttProvider === provider.value && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ sttProvider: provider.value })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.recordingModeButtonText,
                    { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                    settings.sttProvider === provider.value && { color: '#FFFFFF' },
                  ]}>
                    {provider.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {settings.sttProvider === 'app' && (
            <>
              <TouchableOpacity 
                style={[
                  styles.statusCheckButton,
                  { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                  checkingStatus && styles.statusCheckButtonDisabled,
                  checkingStatus && { opacity: 0.6 },
                ]}
                onPress={checkDeepgramStatus}
                activeOpacity={0.7}
                disabled={checkingStatus}
              >
                <Activity size={20} color={checkingStatus ? (isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary) : (isDarkMode ? Colors.dark.text : Colors.light.text)} />
                <Text style={[
                  styles.statusCheckButtonText,
                  { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                  checkingStatus && styles.statusCheckButtonTextDisabled,
                  checkingStatus && { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                ]}>
                  {checkingStatus ? 'Comprovant...' : 'Comprovar estat de Deepgram'}
                </Text>
              </TouchableOpacity>
              
              {statusResult && (
                <View style={[
                  styles.statusResultBox,
                  statusResult.startsWith('✅') ? styles.statusResultSuccess : styles.statusResultError,
                  !statusResult.startsWith('✅') && { backgroundColor: isDarkMode ? '#ef444420' : '#ef444420', borderColor: isDarkMode ? Colors.dark.danger : Colors.light.danger },
                ]}>
                  <Text style={[styles.statusResultText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{statusResult}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Transcripció de veu offline (GRATUÏTA)</Text>
          
          {whisperConfig?.setupCompleted && whisperConfig?.installedModel ? (
            <>
              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <View style={styles.settingInfo}>
                  <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>Model instal·lat</Text>
                    <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                      {whisperConfig.installedModel === 'base' ? 'Base (142 MB)' : 'Tiny (75 MB)'} - 💰 Gratuït
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={styles.settingInfo}>
                  <Languages size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>Idioma per defecte</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Idioma de transcripció offline</Text>
                  </View>
                </View>
                <View style={styles.recordingModeButtons}>
                  {[
                    { value: 'ca', label: 'Català' },
                    { value: 'es', label: 'Espanyol' },
                    { value: 'en', label: 'Anglès' },
                  ].map((lang) => (
                    <TouchableOpacity
                      key={lang.value}
                      style={[
                        styles.recordingModeButton,
                        { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                        whisperLanguage === lang.value && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                      ]}
                      onPress={() => handleChangeWhisperLanguage(lang.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.recordingModeButtonText,
                        { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                        whisperLanguage === lang.value && { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                      ]}>
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={styles.settingInfo}>
                  <Mic size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>Mode de transcripció</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Tria quan processar l'àudio</Text>
                  </View>
                </View>
                <View style={styles.recordingModeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.recordingModeButton,
                      { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                      whisperMode === 'post' && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                    ]}
                    onPress={() => handleChangeWhisperMode('post')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.recordingModeButtonText,
                      { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                      whisperMode === 'post' && { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                    ]}>
                      Post-gravació
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.recordingModeButton,
                      { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                      whisperMode === 'realtime' && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                    ]}
                    onPress={() => handleChangeWhisperMode('realtime')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.recordingModeButtonText,
                      { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                      whisperMode === 'realtime' && { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                    ]}>
                      Temps real
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
                onPress={handleChangeWhisperModel}
                activeOpacity={0.6}
                delayPressIn={0}
              >
                <View style={styles.settingInfo}>
                  <Download size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>Canviar model (gratuït)</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Descarrega un model diferent</Text>
                  </View>
                </View>
                <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
                onPress={handleDeleteWhisperModel}
                activeOpacity={0.6}
                delayPressIn={0}
              >
                <View style={styles.settingInfo}>
                  <Trash size={20} color={isDarkMode ? Colors.dark.danger : Colors.light.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.danger : Colors.light.danger }]}>Eliminar model</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Allibera espai d'emmagatzematge</Text>
                  </View>
                </View>
                <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>

              {/* Free info note */}
              <View style={[styles.infoNote, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <AlertCircle size={16} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                <Text style={[styles.infoNoteText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  ℹ️ Els models Whisper són 100% gratuïts i funcionen offline sense cap cost addicional.
                </Text>
              </View>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
              onPress={() => setShowWhisperSetupModal(true)}
              activeOpacity={0.6}
              delayPressIn={0}
            >
              <View style={styles.settingInfo}>
                <Download size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>Configurar Whisper</Text>
                  <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Descarrega i configura transcripció offline</Text>
                </View>
              </View>
              <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('locationAndWeather')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingInfo}>
              <MapPin size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>Mode d'ubicació</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>Tria com actualitzar la ubicació</Text>
              </View>
            </View>
            <View style={styles.recordingModeButtons}>
              <TouchableOpacity
                style={[
                  styles.recordingModeButton,
                  { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                  settings.locationMode === 'manual' && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ locationMode: 'manual' })}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.recordingModeButtonText,
                  { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                  settings.locationMode === 'manual' && { color: '#FFFFFF' },
                ]}>
                  Manual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordingModeButton,
                  { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                  settings.locationMode === 'auto' && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ locationMode: 'auto' })}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.recordingModeButtonText,
                  { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                  settings.locationMode === 'auto' && { color: '#FFFFFF' },
                ]}>
                  Automàtica
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {settings.locationMode === 'manual' && (
            <TouchableOpacity 
              style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
              onPress={() => setShowLocationModal(true)}
              activeOpacity={0.6}
              delayPressIn={0}
            >
              <View style={styles.settingInfo}>
                <MapPin size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('location')}</Text>
                  <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.weatherLocation}</Text>
                </View>
              </View>
              <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          )}

          {settings.locationMode === 'auto' && (
            <TouchableOpacity 
              style={[
                styles.updateLocationButton,
                { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                updatingLocation && styles.updateLocationButtonDisabled,
                updatingLocation && { opacity: 0.6 },
              ]}
              onPress={async () => {
                setUpdatingLocation(true);
                try {
                  await updateLocationFromCoordinates(true);
                  Alert.alert(
                    t('success') || 'Èxit',
                    `Ubicació actualitzada a: ${settings.weatherLocation}`
                  );
                } catch (error) {
                  Alert.alert(
                    t('error') || 'Error',
                    'No s\'ha pogut actualitzar la ubicació'
                  );
                } finally {
                  setUpdatingLocation(false);
                }
              }}
              activeOpacity={0.7}
              disabled={updatingLocation}
            >
              <MapPin size={20} color={updatingLocation ? (isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary) : (isDarkMode ? Colors.dark.text : Colors.light.text)} />
              <Text style={[
                styles.updateLocationButtonText,
                { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                updatingLocation && styles.updateLocationButtonTextDisabled,
                updatingLocation && { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
              ]}>
                {updatingLocation ? 'Actualitzant ubicació...' : 'Actualitzar ubicació automàticament'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('privacy')}</Text>
          
          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => {
              if (settings.privateNotesPin) {
                setPinConfigAction('change');
              } else {
                setPinConfigAction('set');
              }
              setShowPinConfigModal(true);
            }}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Shield size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('privateNotesPin')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {settings.privateNotesPin ? t('configured') : t('notConfigured')}
                </Text>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('notifications')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Bell size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('notificationsEnabled')}</Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(value) => updateSettings({ notificationsEnabled: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('chatAndResponses')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <MessageSquare size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('voiceResponse')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('assistantRespondsWithVoice')}</Text>
              </View>
            </View>
            <Switch
              value={settings.chatVoiceResponseEnabled}
              onValueChange={(value) => updateSettings({ chatVoiceResponseEnabled: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowTTSModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Volume2 size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('customTTSEngine')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {settings.customTTSUrl || t('googleTTSDefault')}
                </Text>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('audioPlayer')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Music size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('internalPlayer')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('playAudioInApp')}</Text>
              </View>
            </View>
            <Switch
              value={settings.useInternalAudioPlayer}
              onValueChange={(value) => updateSettings({ useInternalAudioPlayer: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('ttsVoiceSpeed')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.ttsVoiceSpeed.toFixed(1)}x</Text>
              </View>
            </View>
          </View>
          <View style={[styles.sliderContainer, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.1}
              value={settings.ttsVoiceSpeed}
              onValueChange={(value) => updateSettings({ ttsVoiceSpeed: value })}
              minimumTrackTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
              maximumTrackTintColor={isDarkMode ? Colors.dark.border : Colors.light.border}
              thumbTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('notes')}</Text>
          
          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowScreenBackgroundColorModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('screenBackgroundColor')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: settings.screenBackgroundColor || '#000000', borderWidth: 1, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }} />
                  <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.screenBackgroundColor || t('noImage')}</Text>
                </View>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('noteBackgroundColor')}</Text>
              </View>
            </View>
            <View style={styles.noteColorButtons}>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#ffffff' },
                  settings.noteBackgroundColor === '#ffffff' && styles.noteColorButtonActive,
                  settings.noteBackgroundColor === '#ffffff' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ noteBackgroundColor: '#ffffff' })}
                activeOpacity={0.7}
              >
                {settings.noteBackgroundColor === '#ffffff' && (
                  <View style={styles.noteColorCheck} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#1a1a1a' },
                  settings.noteBackgroundColor === '#1a1a1a' && styles.noteColorButtonActive,
                  settings.noteBackgroundColor === '#1a1a1a' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ noteBackgroundColor: '#1a1a1a' })}
                activeOpacity={0.7}
              >
                {settings.noteBackgroundColor === '#1a1a1a' && (
                  <View style={[styles.noteColorCheck, { backgroundColor: '#ffffff' }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#D4E5FF' },
                  settings.noteBackgroundColor === '#D4E5FF' && styles.noteColorButtonActive,
                  settings.noteBackgroundColor === '#D4E5FF' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ noteBackgroundColor: '#D4E5FF' })}
                activeOpacity={0.7}
              >
                {settings.noteBackgroundColor === '#D4E5FF' && (
                  <View style={styles.noteColorCheck} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#8B8B8D' },
                  settings.noteBackgroundColor === '#8B8B8D' && styles.noteColorButtonActive,
                  settings.noteBackgroundColor === '#8B8B8D' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ noteBackgroundColor: '#8B8B8D' })}
                activeOpacity={0.7}
              >
                {settings.noteBackgroundColor === '#8B8B8D' && (
                  <View style={[styles.noteColorCheck, { backgroundColor: '#ffffff' }]} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('listBackgroundColor')}</Text>
              </View>
            </View>
            <View style={styles.noteColorButtons}>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#ffffff' },
                  settings.listBackgroundColor === '#ffffff' && styles.noteColorButtonActive,
                  settings.listBackgroundColor === '#ffffff' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ listBackgroundColor: '#ffffff' })}
                activeOpacity={0.7}
              >
                {settings.listBackgroundColor === '#ffffff' && (
                  <View style={styles.noteColorCheck} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#1a1a1a' },
                  settings.listBackgroundColor === '#1a1a1a' && styles.noteColorButtonActive,
                  settings.listBackgroundColor === '#1a1a1a' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ listBackgroundColor: '#1a1a1a' })}
                activeOpacity={0.7}
              >
                {settings.listBackgroundColor === '#1a1a1a' && (
                  <View style={[styles.noteColorCheck, { backgroundColor: '#ffffff' }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#FFDAB9' },
                  settings.listBackgroundColor === '#FFDAB9' && styles.noteColorButtonActive,
                  settings.listBackgroundColor === '#FFDAB9' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ listBackgroundColor: '#FFDAB9' })}
                activeOpacity={0.7}
              >
                {settings.listBackgroundColor === '#FFDAB9' && (
                  <View style={styles.noteColorCheck} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteColorButton,
                  { backgroundColor: '#8B8B8D' },
                  settings.listBackgroundColor === '#8B8B8D' && styles.noteColorButtonActive,
                  settings.listBackgroundColor === '#8B8B8D' && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => updateSettings({ listBackgroundColor: '#8B8B8D' })}
                activeOpacity={0.7}
              >
                {settings.listBackgroundColor === '#8B8B8D' && (
                  <View style={[styles.noteColorCheck, { backgroundColor: '#ffffff' }]} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('advanced')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Shield size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('persistSettings')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('persistSettingsDescription')}</Text>
              </View>
            </View>
            <Switch
              value={settings.persistSettings}
              onValueChange={(value) => updateSettings({ persistSettings: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Bell size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('showCalendarEvents')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('showCalendarEventsDescription')}</Text>
              </View>
            </View>
            <Switch
              value={settings.showCalendarEvents ?? true}
              onValueChange={(value) => updateSettings({ showCalendarEvents: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Maximize size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('hideHomeIcons')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('hideHomeIconsDescription')}</Text>
              </View>
            </View>
            <Switch
              value={!settings.showAppIcons}
              onValueChange={(value) => updateSettings({ showAppIcons: !value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('appearance')}</Text>
          
          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Moon size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('theme')}</Text>
            </View>
            <View style={styles.themeButtons}>
              {[
                { value: 'system' as const, icon: Monitor },
                { value: true as const, icon: Moon },
                { value: false as const, icon: Sun },
              ].map((theme) => (
                <TouchableOpacity
                  key={String(theme.value)}
                  style={[
                    styles.themeIconButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.darkMode === theme.value && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ darkMode: theme.value })}
                  activeOpacity={0.7}
                >
                  <theme.icon 
                    size={20} 
                    color={settings.darkMode === theme.value ? '#FFFFFF' : (isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary)} 
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <RotateCw size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('autoRotation')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('allowScreenRotation')}</Text>
              </View>
            </View>
            <Switch
              value={settings.autoRotateEnabled}
              onValueChange={(value) => updateSettings({ autoRotateEnabled: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowBackgroundModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <ImageIcon size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('wallpaper')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {settings.backgroundImage || t('noImage')}
                </Text>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => setShowColorModal(true)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('accentColor')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: settings.accentColor }} />
                  <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.accentColor}</Text>
                </View>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingInfo}>
              <Maximize size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('iconType')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('iconTypeDescription')}</Text>
              </View>
            </View>
            <View style={styles.iconTypeButtons}>
              {[false, true].map((useSystem) => (
                <TouchableOpacity
                  key={String(useSystem)}
                  style={[
                    styles.iconTypeButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.useSystemIcons === useSystem && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ useSystemIcons: useSystem })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.iconTypeButtonText,
                    { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                    settings.useSystemIcons === useSystem && { color: '#FFFFFF' },
                  ]}>
                    {useSystem ? t('systemIcons') : t('appIcons')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Maximize size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('iconSize')}</Text>
            </View>
            <View style={styles.sizeButtons}>
              {(['small', 'medium', 'large'] as const).map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.iconSize === size && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ iconSize: size })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sizeButtonText,
                    { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                    settings.iconSize === size && { color: '#FFFFFF' },
                  ]}>
                    {size === 'small' ? 'P' : size === 'medium' ? 'M' : 'G'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
            onPress={() => {
              setTempIconStyle(settings.iconStyle);
              setShowIconStyleModal(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Maximize size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('iconStyle')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {t(settings.iconStyle)}
                </Text>
              </View>
            </View>
            <ChevronLeft size={20} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Maximize size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('tagSize')}</Text>
            </View>
            <View style={styles.sizeButtons}>
              {(['small', 'medium', 'large'] as const).map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.tagSize === size && styles.sizeButtonActive,
                    settings.tagSize === size && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ tagSize: size })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sizeButtonText,
                    { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                    settings.tagSize === size && styles.sizeButtonTextActive,
                    settings.tagSize === size && { color: '#FFFFFF' },
                  ]}>
                    {size === 'small' ? 'P' : size === 'medium' ? 'M' : 'G'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Palette size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('tagOpacity')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{Math.round(settings.tagOpacity * 100)}%</Text>
              </View>
            </View>
            <View style={styles.opacityButtons}>
              {[0.5, 0.7, 0.9, 1].map((opacity) => (
                <TouchableOpacity
                  key={opacity}
                  style={[
                    styles.opacityButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.tagOpacity === opacity && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ tagOpacity: opacity })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.opacityButtonText,
                    { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                    settings.tagOpacity === opacity && { color: '#FFFFFF' },
                  ]}>
                    {Math.round(opacity * 100)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Tag size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('showIconNames')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('showNameUnderIcons')}</Text>
              </View>
            </View>
            <Switch
              value={settings.showIconLabels}
              onValueChange={(value) => updateSettings({ showIconLabels: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Clock size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('showClock')}</Text>
                <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('showTimeOnHome')}</Text>
              </View>
            </View>
            <Switch
              value={settings.showClock}
              onValueChange={(value) => updateSettings({ showClock: value })}
              trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
              thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
            />
          </View>

          {settings.showClock && (
            <>
              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <View style={styles.settingInfo}>
                  <Clock size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('enableClockThemeToggle')}</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('enableClockThemeToggleDescription')}</Text>
                  </View>
                </View>
                <Switch
                  value={settings.enableClockThemeToggle}
                  onValueChange={(value) => updateSettings({ enableClockThemeToggle: value })}
                  trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
                  thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
                />
              </View>

              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <View style={styles.settingInfo}>
                  <Clock size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('clockPosition')}</Text>
                </View>
                <View style={styles.positionButtons}>
                  {(['left', 'center', 'right'] as const).map((position) => (
                    <TouchableOpacity
                      key={position}
                      style={[
                        styles.positionButton,
                        { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                        settings.clockPosition === position && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                      ]}
                      onPress={() => updateSettings({ clockPosition: position })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.positionButtonText,
                        { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                        settings.clockPosition === position && { color: '#FFFFFF' },
                      ]}>
                        {position === 'left' ? 'E' : position === 'center' ? 'C' : 'D'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <View style={styles.settingInfo}>
                  <Clock size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('clockSize')}</Text>
                </View>
                <View style={styles.sizeButtons}>
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeButton,
                        { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                        settings.clockSize === size && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                      ]}
                      onPress={() => updateSettings({ clockSize: size })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.sizeButtonText,
                        { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                        settings.clockSize === size && { color: '#FFFFFF' },
                      ]}>
                        {size === 'small' ? 'P' : size === 'medium' ? 'M' : 'G'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                <View style={styles.settingInfo}>
                  <Clock size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('dynamicClock')}</Text>
                    <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('dynamicClockDescription')}</Text>
                  </View>
                </View>
                <Switch
                  value={settings.dynamicClockEnabled ?? true}
                  onValueChange={(value) => updateSettings({ dynamicClockEnabled: value })}
                  trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
                  thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
                />
              </View>

              {settings.dynamicClockEnabled !== false && (
                <>
                  <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
                    <View style={styles.settingInfo}>
                      <Battery size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('batteryWarningPercentage')}</Text>
                        <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.batteryWarningPercentage ?? 15}%</Text>
                        <Text style={[styles.settingDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('batteryWarningDescription')}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.sliderContainer, { paddingHorizontal: 16, paddingBottom: 12 }]}>
                    <Slider
                      style={{ width: '100%', height: 40 }}
                      minimumValue={0}
                      maximumValue={100}
                      step={5}
                      value={settings.batteryWarningPercentage ?? 15}
                      onValueChange={(value) => updateSettings({ batteryWarningPercentage: value })}
                      minimumTrackTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
                      maximumTrackTintColor={isDarkMode ? Colors.dark.border : Colors.light.border}
                      thumbTintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
                    />
                  </View>
                </>
              )}
            </>
          )}

          <View style={[styles.settingRow, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}>
            <View style={styles.settingInfo}>
              <Maximize size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
              <View>
                <Text style={[styles.settingLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('iconsPerRow')}</Text>
                <Text style={[styles.settingValue, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{settings.iconsPerRow}</Text>
              </View>
            </View>
            <View style={styles.iconsPerRowButtons}>
              {[4, 5, 6].map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.iconsPerRowButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                    settings.iconsPerRow === count && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                  ]}
                  onPress={() => updateSettings({ iconsPerRow: count })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.iconsPerRowButtonText,
                    { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                    settings.iconsPerRow === count && { color: '#FFFFFF' },
                  ]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.resetButton, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.danger : Colors.light.danger }]}
          onPress={handleReset}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <RotateCcw size={20} color={isDarkMode ? Colors.dark.danger : Colors.light.danger} />
          <Text style={[styles.resetButtonText, { color: isDarkMode ? Colors.dark.danger : Colors.light.danger }]}>{t('resetSettings')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text, marginBottom: 16 }]}>{t('changeLocation')}</Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={locationInput}
              onChangeText={setLocationInput}
              placeholder={t('enterCity')}
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setLocationInput(settings.weatherLocation);
                  setShowLocationModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveLocation}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSave}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Icon Style Modal */}
      <Modal
        visible={showIconStyleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowIconStyleModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
              {t('iconStyleModal')}
            </Text>
            <Text style={[styles.modalDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary, marginBottom: 20 }]}>
              {t('iconStyleDescription')}
            </Text>
            
            <View style={styles.styleButtons}>
              {(['rounded', 'square', 'circle', 'squircle', 'teardrop', 'default', 'custom'] as const).map((style) => {
                const isSelected = tempIconStyle === style;
                const iconColor = isSelected 
                  ? (isDarkMode ? Colors.dark.text : Colors.light.text) 
                  : (isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary);
                
                // Preview dimensions
                const PREVIEW_SIZE = 40;
                
                return (
                  <TouchableOpacity
                    key={style}
                    style={[
                      styles.styleButton,
                      { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                      isSelected && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                    ]}
                    onPress={() => setTempIconStyle(style)}
                    activeOpacity={0.7}
                  >
                    {style === 'default' ? (
                      <ImageIcon size={20} color={iconColor} />
                    ) : style === 'custom' ? (
                      <Upload size={20} color={iconColor} />
                    ) : (
                      <View style={[
                        styles.stylePreview,
                        { 
                          backgroundColor: 'transparent',
                          borderWidth: 3,
                          borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
                        },
                        style === 'rounded' && { borderRadius: Math.floor(PREVIEW_SIZE * 0.33) }, // 33% ratio
                        style === 'square' && { borderRadius: 0 },
                        style === 'circle' && { borderRadius: Math.floor(PREVIEW_SIZE * 0.5) }, // Full circle
                        style === 'squircle' && { borderRadius: Math.floor(PREVIEW_SIZE * 0.38) }, // 38% ratio - much rounder
                        style === 'teardrop' && { 
                          borderTopLeftRadius: Math.floor(PREVIEW_SIZE * 0.5),    // 50%
                          borderTopRightRadius: Math.floor(PREVIEW_SIZE * 0.5),   // 50%
                          borderBottomLeftRadius: Math.floor(PREVIEW_SIZE * 0.5), // 50%
                          borderBottomRightRadius: Math.floor(PREVIEW_SIZE * 0.1), // 10%
                        },
                        isSelected && { 
                          borderWidth: 4,
                          borderColor: '#FFFFFF',
                        },
                      ]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={{ marginTop: 24 }} />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setTempIconStyle(settings.iconStyle);
                  setShowIconStyleModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {t('cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}
                onPress={() => {
                  updateSettings({ iconStyle: tempIconStyle });
                  setShowIconStyleModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                  {t('save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTTSModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTTSModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('customTTSEngineModal')}</Text>
            <Text style={[styles.modalDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary, marginBottom: 16 }]}>
              {t('enterTTSUrl')}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={ttsUrlInput}
              onChangeText={setTtsUrlInput}
              placeholder="https://..."
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setTtsUrlInput(settings.customTTSUrl || '');
                  setShowTTSModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveTTS}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSave}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBackgroundModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBackgroundModal(false)}
      >
        <View style={[styles.backgroundModalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <ScrollView 
            contentContainerStyle={styles.backgroundModalScrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            <View style={[styles.backgroundModalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('wallpaperModal')}</Text>
              
              {previewImageUri ? (
                <View style={styles.previewContainer}>
                  <Text style={[styles.previewLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('preview')}</Text>
                  <Image 
                    source={{ uri: previewImageUri }} 
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.previewButtons}>
                    <TouchableOpacity 
                      style={[
                        styles.previewButton, 
                        styles.previewButtonCancel,
                        { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }
                      ]}
                      onPress={cancelGalleryImage}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.previewButtonText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.previewButton, 
                        styles.previewButtonConfirm,
                        { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }
                      ]}
                      onPress={confirmGalleryImage}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.previewButtonText, styles.previewButtonTextConfirm, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('confirm')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.galleryButton,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }
                  ]}
                  onPress={pickImageFromGallery}
                  activeOpacity={0.7}
                >
                  <Upload size={20} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                  <Text style={[styles.galleryButtonText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('selectFromGallery')}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
                <Text style={[styles.dividerText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('orChoosePreset')}</Text>
                <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
              </View>

              <View style={styles.presetGrid}>
                {PRESET_BACKGROUNDS.map((url, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.presetOption,
                      settings.backgroundImage === url && styles.presetOptionActive,
                      settings.backgroundImage === url && { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                    ]}
                    onPress={() => selectPresetBackground(url)}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: url }} 
                      style={styles.presetImage}
                      resizeMode="cover"
                    />
                    {settings.backgroundImage === url && (
                      <View style={[styles.presetCheckmark, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>
                        <Text style={[styles.presetCheckmarkText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
                <Text style={[styles.dividerText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('orEnterUrl')}</Text>
                <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
              </View>

              <TextInput
                style={styles.modalInput}
                value={backgroundUrlInput}
                onChangeText={setBackgroundUrlInput}
                placeholder="https://..."
                placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[
                    styles.modalButton, 
                    styles.modalButtonCancel,
                    { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }
                  ]}
                  onPress={() => {
                    setBackgroundUrlInput(settings.backgroundImage || '');
                    setShowBackgroundModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.modalButton, 
                    styles.modalButtonSave,
                    { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }
                  ]}
                  onPress={handleSaveBackground}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSave, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('save')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.removeButton, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}
                onPress={() => {
                  updateSettings({ backgroundImage: undefined });
                  setBackgroundUrlInput('');
                  setShowBackgroundModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.removeButtonText, { color: isDarkMode ? Colors.dark.danger : Colors.light.danger }]}>{t('removeBackground')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showColorModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowColorModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('accentColorModal')}</Text>
            <Text style={[styles.modalDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary, marginBottom: 20 }]}>
              {t('selectPresetOrHex')}
            </Text>
            <View style={styles.colorGrid}>
              {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    colorInput === color && styles.colorOptionActive,
                    colorInput === color && { borderColor: isDarkMode ? Colors.dark.text : Colors.light.text },
                  ]}
                  onPress={() => setColorInput(color)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={colorInput}
              onChangeText={setColorInput}
              placeholder="#6366f1"
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setColorInput(settings.accentColor);
                  setShowColorModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveColor}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSave}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showVoiceButtonColorModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowVoiceButtonColorModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('voiceButtonColorModal')}</Text>
            <Text style={[styles.modalDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary, marginBottom: 20 }]}>
              {t('selectPresetOrHex')}
            </Text>
            <View style={styles.colorGrid}>
              {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    voiceButtonColorInput === color && styles.colorOptionActive,
                    voiceButtonColorInput === color && { borderColor: isDarkMode ? Colors.dark.text : Colors.light.text },
                  ]}
                  onPress={() => setVoiceButtonColorInput(color)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={voiceButtonColorInput}
              onChangeText={setVoiceButtonColorInput}
              placeholder="#6366f1"
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setVoiceButtonColorInput(settings.voiceButtonColor);
                  setShowVoiceButtonColorModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveVoiceButtonColor}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSave}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPinConfigModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPinConfigModal(false);
          setPinConfigInput('');
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={styles.pinModalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                {pinConfigAction === 'set' ? t('configurePIN') : t('changePIN')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPinConfigModal(false);
                  setPinConfigInput('');
                }}
                activeOpacity={0.7}
              >
                <X size={24} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary, marginBottom: 16 }]}>
              {pinConfigAction === 'set' 
                ? 'Introdueix un PIN de 4-6 dígits per protegir les teves notes privades.'
                : 'Introdueix el nou PIN per canviar-lo.'}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={pinConfigInput}
              onChangeText={setPinConfigInput}
              placeholder={t('enterPIN')}
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setShowPinConfigModal(false);
                  setPinConfigInput('');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => {
                  if (pinConfigInput.length < 4) {
                    Alert.alert(t('pinTooShort'), t('pinMustBe4Digits'));
                    return;
                  }
                  updateSettings({ privateNotesPin: pinConfigInput });
                  setPinConfigInput('');
                  setShowPinConfigModal(false);
                  Alert.alert(t('pinConfigured'), t('pinConfiguredSuccess'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSave}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
            {settings.privateNotesPin && (
              <TouchableOpacity 
                style={[styles.removePinButton, { backgroundColor: isDarkMode ? Colors.dark.danger + '20' : Colors.light.danger + '20' }]}
                onPress={() => {
                  Alert.alert(
                    t('removePIN'),
                    t('removePINConfirm'),
                    [
                      { text: t('cancel'), style: 'cancel' },
                      { 
                        text: t('delete'), 
                        style: 'destructive',
                        onPress: () => {
                          updateSettings({ privateNotesPin: undefined });
                          setPinConfigInput('');
                          setShowPinConfigModal(false);
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.removePinButtonText, { color: isDarkMode ? Colors.dark.danger : Colors.light.danger }]}>{t('removePIN')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showScreenBackgroundColorModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowScreenBackgroundColorModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('screenBackgroundColorModal')}</Text>
            <Text style={[styles.modalDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary, marginBottom: 20 }]}>
              {t('screenBackgroundColorDescription')}
            </Text>
            <View style={styles.colorGrid}>
              {['#000000', '#1a1a1a', '#2d2d2d', '#ffffff', '#f5f5f5', '#e0e0e0', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    screenBackgroundColorInput === color && styles.colorOptionActive,
                    screenBackgroundColorInput === color && { borderColor: isDarkMode ? Colors.dark.text : Colors.light.text },
                  ]}
                  onPress={() => setScreenBackgroundColorInput(color)}
                  activeOpacity={0.7}
                />
              ))}
            </View>

            <View style={styles.transparentOption}>
              <TouchableOpacity
                style={[
                  styles.transparentButton,
                  { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                  !screenBackgroundColorInput && styles.transparentButtonActive,
                  !screenBackgroundColorInput && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                ]}
                onPress={() => setScreenBackgroundColorInput('')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.transparentButtonText,
                  { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                  !screenBackgroundColorInput && { color: '#FFFFFF' },
                ]}>
                  {t('transparent')}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={screenBackgroundColorInput}
              onChangeText={setScreenBackgroundColorInput}
              placeholder="#000000"
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight }]}
                onPress={() => {
                  setScreenBackgroundColorInput(settings.screenBackgroundColor || '#000000');
                  setShowScreenBackgroundColorModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveScreenBackgroundColor}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSave}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCustomCommandsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomCommandsModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={styles.commandsModalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('customCommandsModal')}</Text>
              <TouchableOpacity
                onPress={() => setShowCustomCommandsModal(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={{ marginTop: 16 }} />
            
            <ScrollView style={styles.commandsList} showsVerticalScrollIndicator={true}>
              {(!settings.customVoiceCommands || settings.customVoiceCommands.length === 0) ? (
                <View style={styles.emptyCommands}>
                  <Command size={48} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} />
                  <Text style={[styles.emptyCommandsText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('noCustomCommands')}</Text>
                  <Text style={[styles.emptyCommandsSubtext, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('createFirstCommand')}</Text>
                </View>
              ) : (
                settings.customVoiceCommands.map((cmd) => {
                  const conflicts = findConflicts(cmd.pattern);
                  const hasConflict = conflicts.length > 0;
                  return (
                    <View key={cmd.id} style={[styles.commandItem, {
                      backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                      borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
                    }]}>
                      <View style={styles.commandItemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.commandItemName, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{cmd.name}</Text>
                          <Text style={[styles.commandItemPattern, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{cmd.pattern}</Text>
                          <Text style={[styles.commandItemAction, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                            {cmd.action === 'open_app' && t('openApp')}
                            {cmd.action === 'open_url' && t('openUrl')}
                            {cmd.action === 'search' && t('search')}
                            {cmd.action === 'custom' && t('custom')}
                            {': '}{cmd.actionData}
                          </Text>
                        </View>
                        <Switch
                          value={cmd.enabled}
                          onValueChange={(value) => {
                            updateCustomCommand(cmd.id, { enabled: value });
                          }}
                          trackColor={{ false: isDarkMode ? Colors.dark.border : Colors.light.border, true: isDarkMode ? Colors.dark.primary : Colors.light.primary }}
                          thumbColor={isDarkMode ? Colors.dark.text : Colors.light.text}
                        />
                      </View>
                      {hasConflict && (
                        <View style={styles.conflictWarning}>
                          <AlertCircle size={16} color="#f97316" />
                          <Text style={styles.conflictWarningText}>
                            Aquesta comanda sobreposa: {conflicts.join(', ')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.commandItemActions}>
                      <TouchableOpacity
                        style={[styles.commandActionButton, { backgroundColor: isDarkMode ? Colors.dark.primary + '20' : Colors.light.primary + '20' }]}
                        onPress={() => {
                          setEditingCommand(cmd.id);
                          setCommandName(cmd.name);
                          setCommandPattern(cmd.pattern);
                          setCommandAction(cmd.action);
                          setCommandActionData(cmd.actionData);
                          setShowAddCommandModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Edit2 size={16} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
                        <Text style={[styles.commandActionButtonText, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>{t('edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.commandActionButton, { backgroundColor: isDarkMode ? Colors.dark.danger + '20' : Colors.light.danger + '20' }]}
                        onPress={() => {
                          Alert.alert(
                            t('deleteCommand'),
                            `${t('deleteCommandConfirm')} "${cmd.name}"?`,
                            [
                              { text: t('cancel'), style: 'cancel' },
                              { 
                                text: t('delete'), 
                                style: 'destructive',
                                onPress: () => {
                                  deleteCustomCommand(cmd.id);
                                }
                              }
                            ]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color={isDarkMode ? Colors.dark.danger : Colors.light.danger} />
                        <Text style={[styles.commandActionButtonText, { color: isDarkMode ? Colors.dark.danger : Colors.light.danger }]}>{t('delete')}</Text>
                      </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.addCommandButton, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}
              onPress={() => {
                setEditingCommand(null);
                setCommandName('');
                setCommandPattern('');
                setCommandAction('open_url');
                setCommandActionData('');
                setShowAddCommandModal(true);
              }}
              activeOpacity={0.7}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={[styles.addCommandButtonText, { color: '#FFFFFF' }]}>{t('addCommand')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddCommandModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddCommandModal(false);
          setEditingCommand(null);
        }}
      >
        <View style={[styles.addCommandModalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)' }]}>
          <View style={[styles.addCommandModalContainer, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <ScrollView 
              contentContainerStyle={styles.addCommandModalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              <View style={styles.addCommandModalContent}>
                <View style={styles.commandsModalHeader}>
                  <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                    {editingCommand ? t('editCommand') : t('newCommand')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddCommandModal(false);
                      setEditingCommand(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <X size={24} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.inputLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('commandName')}</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background, color: isDarkMode ? Colors.dark.text : Colors.light.text, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
                  value={commandName}
                  onChangeText={setCommandName}
                  placeholder="Ex: Obrir Instagram"
                  placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
                />
                
                <Text style={[styles.inputLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('recognitionPattern')}</Text>
                <Text style={[styles.inputDescription, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
                  {t('recognitionPatternDescription')}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background, color: isDarkMode ? Colors.dark.text : Colors.light.text, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
                  value={commandPattern}
                  onChangeText={setCommandPattern}
                  placeholder="Ex: obr[ei]r?\\s+instagram"
                  placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
                  autoCapitalize="none"
                />
                
                <Text style={[styles.inputLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('actionType')}</Text>
                <View style={styles.actionTypeButtons}>
                  {[
                    { value: 'open_url' as const, label: t('openUrl') },
                    { value: 'open_app' as const, label: t('openApp') },
                    { value: 'search' as const, label: t('search') },
                    { value: 'custom' as const, label: t('custom') },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.actionTypeButton,
                        { backgroundColor: isDarkMode ? Colors.dark.surfaceLight : Colors.light.surfaceLight, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border },
                        commandAction === type.value && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary },
                      ]}
                      onPress={() => setCommandAction(type.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.actionTypeButtonText,
                        { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary },
                        commandAction === type.value && { color: '#FFFFFF' },
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={[styles.inputLabel, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                  {commandAction === 'open_app' && t('appUrlScheme')}
                  {commandAction === 'open_url' && t('urlToOpen')}
                  {commandAction === 'search' && t('textToSearch')}
                  {commandAction === 'custom' && t('customData')}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background, color: isDarkMode ? Colors.dark.text : Colors.light.text, borderColor: isDarkMode ? Colors.dark.border : Colors.light.border }]}
                  value={commandActionData}
                  onChangeText={setCommandActionData}
                  placeholder={
                    commandAction === 'open_app' ? 'Ex: instagram://' :
                    commandAction === 'open_url' ? 'Ex: https://instagram.com' :
                    commandAction === 'search' ? 'Ex: instagram' :
                    'Dades personalitzades'
                  }
                  placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
                  autoCapitalize="none"
                />
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => {
                      setShowAddCommandModal(false);
                      setEditingCommand(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalButtonText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalButtonSave]}
                    onPress={() => {
                      if (!commandName.trim() || !commandPattern.trim() || !commandActionData.trim()) {
                        Alert.alert(t('error'), t('fillAllFields'));
                        return;
                      }
                      
                      if (editingCommand) {
                        updateCustomCommand(editingCommand, {
                          name: commandName,
                          pattern: commandPattern,
                          action: commandAction,
                          actionData: commandActionData,
                        });
                      } else {
                        addCustomCommand({
                          name: commandName,
                          pattern: commandPattern,
                          action: commandAction,
                          actionData: commandActionData,
                          enabled: true,
                        });
                      }
                      
                      setShowAddCommandModal(false);
                      setEditingCommand(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, styles.modalButtonTextSave]}>
                      {editingCommand ? t('update') : t('create')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAppLanguageModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAppLanguageModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={styles.commandsModalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('appLanguageModal')}</Text>
              <TouchableOpacity
                onPress={() => setShowAppLanguageModal(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={{ marginTop: 16 }} />
            
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={true}>
              {[
                { code: 'ca-ES' as const, name: 'Català', nativeName: 'Català' },
                { code: 'es-ES' as const, name: 'Español', nativeName: 'Español' },
                { code: 'en-US' as const, name: 'English', nativeName: 'English' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageItem,
                    settings.appLanguage === lang.code && { 
                      backgroundColor: isDarkMode ? Colors.dark.primary + '20' : Colors.light.primary + '20',
                      borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary,
                    },
                  ]}
                  onPress={async () => {
                    console.log('Changing app language to:', lang.code);
                    await updateSettings({ appLanguage: lang.code, speechLanguage: lang.code });
                    setShowAppLanguageModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.languageItemName,
                      { color: isDarkMode ? Colors.dark.text : Colors.light.text },
                      settings.appLanguage === lang.code && { fontWeight: '600', color: '#FFFFFF' },
                    ]}>
                      {lang.nativeName}
                    </Text>
                    {lang.name !== lang.nativeName && (
                      <Text style={[styles.languageItemSubtext, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{lang.name}</Text>
                    )}
                  </View>
                  {settings.appLanguage === lang.code && (
                    <View style={styles.languageCheckmark}>
                      <Text style={styles.languageCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWhisperSetupModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowWhisperSetupModal(false)}
      >
        <WhisperSetupScreen
          onComplete={async () => {
            setShowWhisperSetupModal(false);
            await whisper.initializeWhisper();
            const config = await loadConfig();
            setWhisperConfig(config);
          }}
          onSkip={() => setShowWhisperSetupModal(false)}
        />
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    gap: 32,
    paddingBottom: 100,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  settingValue: {
    fontSize: 14,
    marginTop: 2,
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  languageButtonsContainer: {
    flex: 1,
    gap: 8,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    marginBottom: 8,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  languageButtonActive: {
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  languageButtonTextActive: {
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  recordingModeButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  recordingModeButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingModeButtonActive: {
  },
  recordingModeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  recordingModeButtonTextActive: {
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonSave: {
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalButtonTextSave: {
  },
  sizeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeButtonActive: {
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sizeButtonTextActive: {
  },
  styleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleButtonActive: {
  },
  stylePreview: {
    width: 40,
    height: 40,
  },
  opacityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  opacityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  opacityButtonActive: {
  },
  opacityButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  opacityButtonTextActive: {
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  positionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionButtonActive: {
  },
  positionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  positionButtonTextActive: {
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionActive: {
  },
  backgroundModalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  backgroundModalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 80,
  },
  backgroundModalContent: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    gap: 16,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  galleryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetOption: {
    width: '48%',
    aspectRatio: 9 / 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  presetOptionActive: {
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  presetCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetCheckmarkText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  removeButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  previewContainer: {
    gap: 12,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 12,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewButtonCancel: {
    borderWidth: 1,
  },
  previewButtonConfirm: {
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  previewButtonTextConfirm: {
  },
  iconsPerRowButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconsPerRowButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconsPerRowButtonActive: {
  },
  iconsPerRowButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  iconsPerRowButtonTextActive: {
  },
  sliderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: -8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  pinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  removePinButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  removePinButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  noteColorButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
    marginTop: 12,
  },
  noteColorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteColorButtonActive: {
    borderWidth: 3,
  },
  noteColorCheck: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeButtonActive: {
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  themeButtonTextActive: {
  },
  themeIconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIconButtonActive: {
  },
  transparentOption: {
    marginTop: 8,
  },
  transparentButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  transparentButtonActive: {
  },
  transparentButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  transparentButtonTextActive: {
  },
  commandsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  commandsList: {
    maxHeight: 400,
  },
  emptyCommands: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyCommandsText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  emptyCommandsSubtext: {
    fontSize: 14,
  },
  commandItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  commandItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  commandItemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  commandItemPattern: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  commandItemAction: {
    fontSize: 12,
  },
  commandItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  commandActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  commandActionButtonDanger: {
  },
  commandActionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addCommandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  addCommandButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  addCommandModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCommandModalContainer: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 24,
  },
  addCommandModalScrollContent: {
    paddingVertical: 24,
  },
  addCommandModalContent: {
    paddingHorizontal: 24,
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  inputDescription: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  actionTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionTypeButtonActive: {
  },
  actionTypeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  actionTypeButtonTextActive: {
  },
  languageList: {
    maxHeight: 500,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  languageItemName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  languageItemSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  languageCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageCheckmarkText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  customColorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  customColorButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  colorPreviewBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
  },
  colorPreviewText: {
    fontSize: 16,
    fontWeight: '600' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  iconTypeButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  iconTypeButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTypeButtonActive: {
  },
  iconTypeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  iconTypeButtonTextActive: {
  },
  statusCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  statusCheckButtonDisabled: {
  },
  statusCheckButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  statusCheckButtonTextDisabled: {
  },
  statusResultBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  statusResultSuccess: {
    backgroundColor: '#22c55e' + '20',
    borderColor: '#22c55e',
  },
  statusResultError: {
  },
  statusResultText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  conflictWarning: {
    marginTop: 8,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f97316' + '20',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  conflictWarningText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  updateLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  updateLocationButtonDisabled: {
  },
  updateLocationButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  updateLocationButtonTextDisabled: {
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
