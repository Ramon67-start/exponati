import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, useWindowDimensions, Linking, PanResponder, Pressable, useColorScheme, Platform, StatusBar, Keyboard, KeyboardAvoidingView, Animated, AppState, Image } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import * as Battery from 'expo-battery';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useRef, useCallback } from 'react';
import { useLauncher } from '@/contexts/LauncherContext';
import { useSettings } from '@/contexts/SettingsContext';
import Colors from '@/constants/colors';
import * as Icons from 'lucide-react-native';
import { LucideIcon } from 'lucide-react-native';
import SettingsPage from './SettingsPage';
import LauncherModeSelector from './LauncherModeSelector';
import SettingsPageBasic from './SettingsPageBasic';
import { AppShortcut, CommandTag, IconStyle } from '@/types';
import TagEditorModal from './TagEditorModal';
import { useTranslations } from '@/constants/translations';
import CustomAlert from './CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { executeVoiceCommand } from '@/utils/voiceCommands';
import { getUpcomingEvents, CalendarEvent } from '@/utils/calendar';
import HelpPage from './HelpPage';
import { launchApp } from '@/services/InstalledAppsService';

const getIcon = (iconName: string): LucideIcon => {
  const iconMap: Record<string, LucideIcon> = {
    'phone': Icons.Phone,
    'message-circle': Icons.MessageCircle,
    'camera': Icons.Camera,
    'image': Icons.Image,
    'mail': Icons.Mail,
    'music': Icons.Music,
    'video': Icons.Video,
    'map': Icons.Map,
    'calendar': Icons.Calendar,
    'settings': Icons.Settings,
  };
  return iconMap[iconName] || Icons.Circle;
};

const getSystemIconEmoji = (iconName: string): string => {
  const emojiMap: Record<string, string> = {
    'phone': '📞',
    'message-circle': '💬',
    'camera': '📷',
    'image': '🖼️',
    'mail': '✉️',
    'music': '🎵',
    'video': '🎬',
    'map': '🗺️',
    'calendar': '📅',
    'settings': '⚙️',
    'circle': '⭕',
  };
  return emojiMap[iconName] || '⭕';
};

interface HomePageProps {
  navigateToNotes?: (searchFilter?: string) => void;
  currentPage?: number;
}

export default function HomePage({ navigateToNotes, currentPage }: HomePageProps = {}) {
  const { homeScreenShortcuts, allApps, tags, notes, addShortcut, deleteShortcut, addTag, deleteTag, updateShortcut, updateTag, setNotesSearchFilter, addNote, addToList, updateNote } = useLauncher();
  const { settings, updateSettings, deleteCustomCommand, updateCustomCommand } = useSettings();
  const { t } = useTranslations(settings.appLanguage || 'ca-ES');
  const colorScheme = useColorScheme();
  const clockTheme = settings.clockDateTheme || 'system';
  const isDarkMode = clockTheme === 'system'
    ? (settings.darkMode === 'system' ? (colorScheme === 'dark') : settings.darkMode)
    : clockTheme === 'dark';
  const isTagDark = settings.darkMode === 'system'
    ? (colorScheme === 'dark')
    : settings.darkMode === true;
  const tagBackgroundColor = isTagDark ? Colors.dark.surface : '#f0f0f0';
  const tagBorderColor = isTagDark ? Colors.dark.border : '#d0d0d0';
  const { width, height } = useWindowDimensions();
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showTagEditorModal, setShowTagEditorModal] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [selectedTag, setSelectedTag] = useState<CommandTag | null>(null);
  const [shortcutName, setShortcutName] = useState('');
  const [shortcutIcon, setShortcutIcon] = useState('circle');
  const DEFAULT_INPUT_HEIGHT = 44;
  const [searchInputHeight, setSearchInputHeight] = useState(DEFAULT_INPUT_HEIGHT);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

// Handler optimitzat, just a sota dels useState!
  const handleSearchInputChange = (text: string) => {
  setSearchQuery(text);
  const hasResults = text.trim().length > 0;
  setIsSearching(hasResults && isSearchFocused);
  setShowSearchResults(hasResults);

  if (text === '') {
    setSearchInputHeight(DEFAULT_INPUT_HEIGHT); // Torna a l'alçada original si està buit
    setIsSearching(false);
    setShowSearchResults(false);
   }
  };
  
  const [tagLabel, setTagLabel] = useState('');
  const [tagCommand, setTagCommand] = useState('');
  const [prefilledAppData, setPrefilledAppData] = useState<{ name: string; packageName: string } | undefined>(undefined);
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppShortcut | null>(null);
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [showBasicSettings, setShowBasicSettings] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastTap, setLastTap] = useState<number>(0);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [localShowAppLabels, setLocalShowAppLabels] = useState<boolean>(settings.showAppLabels ?? true);
  const [localShowAppIcons, setLocalShowAppIcons] = useState<boolean>(settings.showAppIcons ?? true);
  const drawerTranslateY = useRef(new Animated.Value(height)).current;
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const [showHelpPage, setShowHelpPage] = useState(false);
  const [addingAppToHome, setAddingAppToHome] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.2)).current;
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [clockTextColor, setClockTextColor] = useState('#ffffff');
  const [dateTextColor, setDateTextColor] = useState('#cccccc');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [showDrawerAppMenu, setShowDrawerAppMenu] = useState(false);
  const [selectedDrawerApp, setSelectedDrawerApp] = useState<AppShortcut | null>(null);
  const [showSearchItemMenu, setShowSearchItemMenu] = useState(false);
  const [selectedSearchItem, setSelectedSearchItem] = useState<{ type: 'app' | 'contact' | 'email' | 'tag' | 'command'; data: any } | null>(null);

  // Estados para controlar las animaciones del reloj dinámico
  // NOTA: La detección automática de estos estados (modo silencio, llamadas perdidas,
  // alarmas activas, mensajes sin leer) requiere módulos nativos específicos de cada
  // plataforma que deben ser implementados por separado. Esta implementación proporciona
  // la estructura y las animaciones, lista para integrar con las APIs nativas.
  const [isPhoneSilent, setIsPhoneSilent] = useState(false);
  const [hasMissedCalls, setHasMissedCalls] = useState(false);
  const [hasAlarmRunning, setHasAlarmRunning] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);

  // Refs para las animaciones del reloj dinámico
  const vibrationAnim = useRef(new Animated.Value(0)).current;
  const slideDownAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const showAppLabels = localShowAppLabels;
  const showAppIcons = localShowAppIcons;

  const isLandscape = useMemo(() => width > height, [width, height]);
  const insets = useSafeAreaInsets();

  // Memoize event ScrollView content container style to prevent unnecessary re-renders
  const eventScrollViewStyle = useMemo(() => ({ flexGrow: 0 }), []);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log('=== Settings changed from context ===', {
      showAppLabels: settings.showAppLabels,
      showAppIcons: settings.showAppIcons,
      localShowAppLabels,
      localShowAppIcons
    });

    if (settings.showAppLabels !== undefined && settings.showAppLabels !== localShowAppLabels) {
      console.log('Updating localShowAppLabels to:', settings.showAppLabels);
      setLocalShowAppLabels(settings.showAppLabels);
    }
    if (settings.showAppIcons !== undefined && settings.showAppIcons !== localShowAppIcons) {
      console.log('Updating localShowAppIcons to:', settings.showAppIcons);
      setLocalShowAppIcons(settings.showAppIcons);
    }
  }, [settings.showAppLabels, settings.showAppIcons]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('App became active - triggering entrance animation and clearing search');
        setSearchQuery('');
        setShowSearchResults(false);
        setIsSearching(false);
        setIsSearchFocused(false);
        setIsPageVisible(false);
        fadeAnim.setValue(0);
        scaleAnim.setValue(1.2);
        setTimeout(() => {
          setIsPageVisible(true);
          Animated.parallel([
            Animated.spring(fadeAnim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 20,
              friction: 7,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 20,
              friction: 7,
            }),
          ]).start();
        }, 50);
      }
    });

    fadeAnim.setValue(0);
    scaleAnim.setValue(1.2);
    setIsPageVisible(true);
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 20,
        friction: 7,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 20,
        friction: 7,
      }),
    ]).start();

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const loadCalendarEvents = async () => {
      const events = await getUpcomingEvents(3);
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const filteredEvents = events.filter(event => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        // Show events that haven't ended yet and start before tomorrow
        return eventStartDate <= tomorrow && eventEndDate >= now;
      });

      setCalendarEvents(filteredEvents);
    };

    loadCalendarEvents();

    const interval = setInterval(loadCalendarEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  const isImageBackground = settings.backgroundImage && settings.backgroundImage.startsWith('file://');
  const isColorBackground = settings.screenBackgroundColor && settings.screenBackgroundColor !== '#2d2d2d';

  useEffect(() => {
    const calculateTextColor = async () => {
      if (isImageBackground && settings.backgroundImage) {
        try {
          const brightness = await getImageBrightness(settings.backgroundImage);
          if (brightness > 0.5) {
            setClockTextColor('#000000');
            setDateTextColor('#555555');
          } else {
            setClockTextColor('#ffffff');
            setDateTextColor('#cccccc');
          }
        } catch (error) {
          console.error('Error calculating brightness:', error);
          setClockTextColor('#ffffff');
          setDateTextColor('#cccccc');
        }
      } else if (isColorBackground && settings.screenBackgroundColor) {
        const brightness = getColorBrightness(settings.screenBackgroundColor);
        if (brightness > 0.5) {
          setClockTextColor('#000000');
          setDateTextColor('#555555');
        } else {
          setClockTextColor('#ffffff');
          setDateTextColor('#cccccc');
        }
      } else {
        if (isDarkMode) {
          setClockTextColor('#ffffff');
          setDateTextColor('#cccccc');
        } else {
          setClockTextColor('#000000');
          setDateTextColor('#555555');
        }
      }
    };
    calculateTextColor();
  }, [settings.backgroundImage, settings.screenBackgroundColor, isImageBackground, isColorBackground, isDarkMode]);

  useEffect(() => {
    if (currentPage !== 1) {
      setShowSearchResults(false);
      setSearchQuery('');
    }
  }, [currentPage]);

  // useEffect para monitorizar batería
  useEffect(() => {
    if (!settings.dynamicClockEnabled) return;

    const checkBattery = async () => {
      const level = await Battery.getBatteryLevelAsync();
      setBatteryLevel(level * 100);
    };

    checkBattery();
    // Intervalo de 60 segundos es razonable para monitoreo de batería
    // ya que el nivel de batería cambia gradualmente
    const interval = setInterval(checkBattery, 60000);

    return () => clearInterval(interval);
  }, [settings.dynamicClockEnabled]);

  // useEffect para animación de vibración (trucadas perdidas, alarmas, eventos)
  useEffect(() => {
    if (!settings.dynamicClockEnabled) return;
    if (!hasMissedCalls && !hasAlarmRunning && calendarEvents.length === 0) {
      vibrationAnim.setValue(0);
      return;
    }

    const vibrate = Animated.sequence([
      Animated.timing(vibrationAnim, { toValue: 3, duration: 50, useNativeDriver: true }),
      Animated.timing(vibrationAnim, { toValue: -3, duration: 50, useNativeDriver: true }),
      Animated.timing(vibrationAnim, { toValue: 3, duration: 50, useNativeDriver: true }),
      Animated.timing(vibrationAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]);

    const loop = Animated.loop(
      Animated.sequence([
        vibrate,
        Animated.delay(2000), // repetir cada 2 segundos
      ]),
      { iterations: -1 }
    );
    loop.start();

    return () => loop.stop();
  }, [settings.dynamicClockEnabled, hasMissedCalls, hasAlarmRunning, calendarEvents]);

  // useEffect para animación de desplazamiento (correo/mensajes)
  useEffect(() => {
    if (!settings.dynamicClockEnabled || !hasUnreadMessages) {
      slideDownAnim.setValue(0);
      // No resetear blinkAnim aquí porque podría estar siendo usado por la animación de batería baja
      return;
    }

    const slideDown = Animated.sequence([
      Animated.parallel([
        Animated.timing(slideDownAnim, { toValue: 100, duration: 1000, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(slideDownAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
      Animated.delay(2000),
    ]);

    const loop = Animated.loop(slideDown, { iterations: -1 });
    loop.start();

    return () => loop.stop();
  }, [settings.dynamicClockEnabled, hasUnreadMessages]);

  // useEffect para animación de parpadeo (batería baja)
  useEffect(() => {
    const warningPercentage = settings.batteryWarningPercentage ?? 15;
    // No hacer parpadeo si hay mensajes sin leer (la animación de slide-down tiene prioridad)
    if (!settings.dynamicClockEnabled || warningPercentage === 0 || batteryLevel > warningPercentage || hasUnreadMessages) {
      // Solo resetear si no hay mensajes (para no interferir con slide-down)
      if (!hasUnreadMessages) {
        blinkAnim.setValue(1);
      }
      return;
    }

    const blink = Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]);

    const loop = Animated.loop(blink, { iterations: -1 });
    loop.start();

    return () => loop.stop();
  }, [settings.dynamicClockEnabled, batteryLevel, settings.batteryWarningPercentage, hasUnreadMessages]);

  const handleAddShortcut = () => {
    if (shortcutName.trim()) {
      const newShortcut: AppShortcut = {
        id: Date.now().toString(),
        name: shortcutName.trim(),
        icon: shortcutIcon,
        type: 'app',
      };
      addShortcut(newShortcut);
      setShortcutName('');
      setShortcutIcon('circle');
      setShowShortcutModal(false);
    }
  };

  const handleDeleteShortcut = (id: string, name: string) => {
    showAlert(
      t('deleteShortcut'),
      `${t('deleteShortcutConfirm')} "${name}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => deleteShortcut(id) },
      ]
    );
  };

  const handleAppPress = async (app: AppShortcut) => {
    console.log('Opening app:', app.name, app.packageName);
    if (app.packageName) {
      try {
        // Intent URIs (tel:, sms:, mailto:, etc.)
        if (app.packageName.includes(':')) {
          await Linking.openURL(app.packageName);
          return;
        }

        // Apps natives (Android)
        if (Platform.OS === 'android') {
          const launched = await launchApp(app.packageName);
          if (launched) return;
        }

        // Fallback: intent URI
        const canOpen = await Linking.canOpenURL(app.packageName);
        if (canOpen) {
          await Linking.openURL(app.packageName);
        } else {
          showAlert(t('cannotOpenApp'), t('noActionConfigured').replace('{name}', app.name), [
            { text: 'OK', style: 'default' }
          ]);
        }
      } catch (error) {
        console.error('Error opening app:', error);
        showAlert(t('error'), t('noActionConfigured').replace('{name}', app.name), [
          { text: 'OK', style: 'default' }
        ]);
      }
    } else {
      showAlert(t('info'), t('noActionConfigured').replace('{name}', app.name), [
        { text: 'OK', style: 'default' }
      ]);
    }
  };

  const handleAppLongPress = (app: AppShortcut) => {
    setSelectedApp(app);
    setShowAppMenu(true);
  };

  const [showModeSelector, setShowModeSelector] = useState(false);

  const handleEmptySpaceLongPress = () => {
    setShowModeSelector(true);
  };

  const handleClockPress = useCallback(async () => {
    try {
      const clockUrl = Platform.select({
        ios: 'clock-worldclock://',
        android: 'intent:#Intent;action=android.intent.action.SHOW_ALARMS;end',
        default: 'clock://'
      });
      if (clockUrl) {
        const canOpen = await Linking.canOpenURL(clockUrl);
        if (canOpen) {
          await Linking.openURL(clockUrl);
        }
      }
    } catch (error) {
      console.error('Error opening clock app:', error);
    }
  }, []);

  const handleDatePress = useCallback(async () => {
    try {
      const calendarUrl = Platform.select({
        ios: 'calshow://',
        android: 'content://com.android.calendar/time/',
        default: 'calendar://'
      });
      if (calendarUrl) {
        const canOpen = await Linking.canOpenURL(calendarUrl);
        if (canOpen) {
          await Linking.openURL(calendarUrl);
        }
      }
    } catch (error) {
      console.error('Error opening calendar app:', error);
    }
  }, []);

  const handleClockPressWithEffects = useCallback(() => {
    // Detener todas las animaciones y limpiar notificaciones
    setHasMissedCalls(false);
    setHasAlarmRunning(false);
    setHasUnreadMessages(false);

    // Si está en modo silencio, desactivarlo
    // NOTA: La detección real del modo silencio y su cambio requieren módulos nativos
    // específicos de la plataforma. Esta es la estructura para implementarlo.
    if (isPhoneSilent && settings.dynamicClockEnabled) {
      setIsPhoneSilent(false);
    }

    // Llamar la función original de click
    handleClockPress();
  }, [isPhoneSilent, settings.dynamicClockEnabled, handleClockPress]);

  const [lastClockTap, setLastClockTap] = useState<number>(0);
  const handleClockDoublePress = useCallback(() => {
    if (!settings.enableClockThemeToggle) return;

    const now = Date.now();
    if (now - lastClockTap < 300) {
      const currentTheme = settings.clockDateTheme || 'system';
      const nextTheme = currentTheme === 'system' ? 'light' : currentTheme === 'light' ? 'dark' : 'system';
      updateSettings({ clockDateTheme: nextTheme });
    }
    setLastClockTap(now);
  }, [lastClockTap, settings.enableClockThemeToggle, settings.clockDateTheme, updateSettings]);

  const handleToggleHomeScreen = async () => {
    if (selectedApp) {
      await updateShortcut(selectedApp.id, { onHomeScreen: !selectedApp.onHomeScreen });
      setShowAppMenu(false);
      setSelectedApp(null);
    }
  };



  const openAppDrawerWithAnimation = useCallback(() => {
    setShowAppDrawer(true);
    drawerTranslateY.setValue(height);
    Animated.spring(drawerTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [drawerTranslateY, height]);

  const closeAppDrawerWithAnimation = useCallback(() => {
    Animated.timing(drawerTranslateY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowAppDrawer(false);
    });
  }, [drawerTranslateY, height]);

  const gestureDirection = useRef<'vertical' | 'horizontal' | null>(null);
  const gestureStartPosition = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    gestureDirection.current = null;
    gestureStartPosition.current = null;
    console.log('=== HomePage mounted - PanResponder state reset ===');
  }, []);

  const resetGestureState = useCallback(() => {
    gestureDirection.current = null;
    gestureStartPosition.current = null;
    console.log('=== PanResponder state reset ===');
  }, []);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) => {
        if (showSearchResults) {
          return false;
        }
        if (gestureState.dx === 0 && gestureState.dy === 0) {
          resetGestureState();
        }
        return false;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (showSearchResults) {
          return false;
        }
        const absX = Math.abs(gestureState.dx);
        const absY = Math.abs(gestureState.dy);
        const totalDistance = Math.sqrt(absX * absX + absY * absY);

        if (totalDistance < 3) {
          if (gestureDirection.current !== null) {
            console.log('=== Distance too small, resetting gesture state ===');
            resetGestureState();
          }
          return false;
        }

        if (gestureDirection.current === null) {
          if (absY > absX * 0.8) {
            gestureDirection.current = 'vertical';
            console.log('=== Direction locked: VERTICAL ===', { absX, absY, ratio: absY / absX });
            return true;
          } else if (absX > absY * 1.2) {
            gestureDirection.current = 'horizontal';
            console.log('=== Direction locked: HORIZONTAL ===', { absX, absY, ratio: absX / absY });
            return false;
          }
          return false;
        }

        const shouldCapture = gestureDirection.current === 'vertical' && absY > 3;
        console.log('PanResponder onMoveShouldSetPanResponder:', {
          absX,
          absY,
          totalDistance,
          direction: gestureDirection.current,
          shouldCapture
        });

        return shouldCapture;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
      },
      onPanResponderRelease: (_, gestureState) => {
        const absX = Math.abs(gestureState.dx);
        const absY = Math.abs(gestureState.dy);
        const vy = gestureState.vy;

        console.log('=== PanResponder Release ===', {
          dx: gestureState.dx,
          dy: gestureState.dy,
          absX,
          absY,
          vy,
          direction: gestureDirection.current,
          currentShowAppLabels: showAppLabels,
          currentShowAppIcons: showAppIcons,
        });

        const isVerticalGesture = gestureDirection.current === 'vertical';
        const hasMinDistance = absY > 50;

        resetGestureState();

        if (!isVerticalGesture || !hasMinDistance) {
          console.log('Not vertical gesture or min distance not met - IGNORING');
          return;
        }

        if (gestureState.dy < -40) {
          console.log('=== SWIPE UP DETECTED ===');

          const hideIconsConfig = settings.showAppIcons === false;
          console.log('Hide icons config active:', hideIconsConfig);

          if (!hideIconsConfig) {
            if (!showAppIcons && !showAppLabels) {
              console.log('State: Both hidden (normal mode) -> SHOW ICONS');
              setLocalShowAppIcons(true);
            } else if (showAppIcons && !showAppLabels) {
              console.log('State: Icons visible, Labels hidden -> SHOW LABELS');
              setLocalShowAppLabels(true);
            } else if (showAppIcons && showAppLabels) {
              console.log('State: Both visible -> OPEN APP DRAWER');
              openAppDrawerWithAnimation();
            }
          } else {
            if (!showAppLabels) {
              console.log('State: Labels hidden (hide icons mode) -> SHOW LABELS');
              setLocalShowAppLabels(true);
            } else if (showAppLabels) {
              console.log('State: Labels visible (hide icons mode) -> OPEN APP DRAWER');
              openAppDrawerWithAnimation();
            }
          }
        } else if (gestureState.dy > 40) {
          console.log('=== SWIPE DOWN DETECTED ===');

          const hideIconsConfig = settings.showAppIcons === false;
          console.log('Hide icons config active:', hideIconsConfig);

          if (!hideIconsConfig) {
            if (showAppIcons && showAppLabels) {
              console.log('State: Both visible (normal mode) -> HIDE LABELS FIRST');
              setLocalShowAppLabels(false);
            } else if (showAppIcons && !showAppLabels) {
              console.log('State: Icons visible, Labels hidden -> HIDE ICONS');
              setLocalShowAppIcons(false);
            }
          } else {
            if (showAppLabels) {
              console.log('State: Labels visible (hide icons mode) -> HIDE LABELS');
              setLocalShowAppLabels(false);
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        resetGestureState();
      },
    }),
    [showSearchResults, showAppLabels, showAppIcons, settings, updateSettings, openAppDrawerWithAnimation, resetGestureState]
  );

  const handleAddTag = () => {
    if (tagLabel.trim() && tagCommand.trim()) {
      const newTag: CommandTag = {
        id: Date.now().toString(),
        label: tagLabel.trim(),
        command: tagCommand.trim(),
        actionType: 'command',
      };
      addTag(newTag);
      setTagLabel('');
      setTagCommand('');
      setShowTagModal(false);
    }
  };

  const handleSaveTagFromEditor = (tag: CommandTag) => {
    if (selectedTag) {
      updateTag(selectedTag.id, tag);
    } else {
      addTag(tag);
    }
    setSelectedTag(null);
    setPrefilledAppData(undefined);
  };

  const handleTagLongPress = (tag: CommandTag) => {
    setSelectedTag(tag);
    setShowTagMenu(true);
  };

  const handleTagPress = async (tag: CommandTag) => {
    console.log('Tag pressed:', tag);

    if (tag.command === 'ajuda' || tag.command === 'ayuda' || tag.command === 'help') {
      setShowHelpPage(true);
      return;
    }

    if (tag.actionType === 'app' && tag.appPackageName) {
      try {
        const canOpen = await Linking.canOpenURL(tag.appPackageName);
        if (canOpen) {
          await Linking.openURL(tag.appPackageName);
        } else {
          showAlert(t('cannotOpenApp'), t('noActionConfigured').replace('{name}', tag.label), [
            { text: 'OK', style: 'default' }
          ]);
        }
      } catch (error) {
        console.error('Error opening app from tag:', error);
      }
    } else if (tag.actionType === 'url' && tag.url) {
      try {
        const canOpen = await Linking.canOpenURL(tag.url);
        if (canOpen) {
          await Linking.openURL(tag.url);
        }
      } catch (error) {
        console.error('Error opening URL:', error);
      }
    } else if (tag.actionType === 'command' && tag.command) {
      await executeVoiceCommand(tag.command, undefined, settings.customVoiceCommands, settings.appLanguage || 'ca-ES', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, notes, undefined, undefined, undefined, updateNote);
    }
  };

  const handleDeleteTag = (id: string, label: string) => {
    showAlert(
      t('deleteTag'),
      `${t('deleteTagConfirm')} "${label}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => deleteTag(id) },
      ]
    );
  };

  const isTagVisible = (tag: CommandTag): boolean => {
    if (!tag.timeRestriction || !tag.timeRestriction.enabled) {
      return true;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const startTimeInMinutes = tag.timeRestriction.startHour * 60 + tag.timeRestriction.startMinute;
    const endTimeInMinutes = tag.timeRestriction.endHour * 60 + tag.timeRestriction.endMinute;

    if (startTimeInMinutes <= endTimeInMinutes) {
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    } else {
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    }
  };



  const iconSizeMap: Record<'small' | 'medium' | 'large', { container: number; icon: number }> = {
    small: { container: 56, icon: 24 },
    medium: { container: 64, icon: 28 },
    large: { container: 72, icon: 32 },
  };

  // Icon style border radius mapping
  // - rounded: 20px for moderate rounding (good for 60-80px containers)
  // - square: 8px for subtle corners
  // - circle: 100px to ensure full circular shape
  // - squircle: 38px (~38% of typical 100px container) for much rounder iOS-style superellipse
  // - teardrop: 20px base (asymmetric corners applied dynamically below)
  // - default: 0px for original app icon appearance
  // - custom: 20px base (for future custom icon support)
  const iconRadiusMap: Record<IconStyle, number> = {
    rounded: 20,
    square: 8,
    circle: 100,
    squircle: 38,
    teardrop: 20,
    default: 0,
    custom: 20,
  };

  // Helper function to get border radius style for teardrop icons
  // Teardrop has 3 rounded corners (50% of container) and 1 slightly rounded corner (10%)
  const getTeardropBorderRadius = (containerSize: number) => ({
    borderTopLeftRadius: Math.floor(containerSize * 0.5),
    borderTopRightRadius: Math.floor(containerSize * 0.5),
    borderBottomLeftRadius: Math.floor(containerSize * 0.5),
    borderBottomRightRadius: Math.floor(containerSize * 0.1),
  });

  const currentIconSize = settings.iconSize || 'medium';
  const currentIconStyle = settings.iconStyle || 'rounded';
  const currentAccentColor = settings.accentColor || '#6366f1';
  const currentTagOpacity = settings.tagOpacity ?? 0.9;
  const currentTagSize = settings.tagSize || 'small';
  const currentClockPosition = settings.clockPosition || 'center';
  const currentClockSize = settings.clockSize || 'large';
  const currentIconsPerRow = settings.iconsPerRow || 4;

  const tagSizeMap: Record<'small' | 'medium' | 'large', { paddingH: number; paddingV: number; fontSize: number }> = {
    small: { paddingH: 11, paddingV: 5.5, fontSize: 12.5 },
    medium: { paddingH: 12, paddingV: 7, fontSize: 12.5 },
    large: { paddingH: 14, paddingV: 8, fontSize: 13 },
  };

  const clockSizeMap: Record<'small' | 'medium' | 'large', { fontSize: number; dateSize: number }> = {
    small: { fontSize: 48, dateSize: 16 },
    medium: { fontSize: 60, dateSize: 18 },
    large: { fontSize: 72, dateSize: 20 },
  };

  const iconWidth = useMemo(() => {
    const screenPadding = isLandscape ? 80 : 48;
    const gapTotal = (currentIconsPerRow - 1) * 16;
    return (width - screenPadding - gapTotal) / currentIconsPerRow;
  }, [width, currentIconsPerRow, isLandscape]);

  const backgroundColor = settings.screenBackgroundColor || (isDarkMode ? Colors.dark.background : '#f5f5f5');

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      console.log('Double tap detected - toggling voice button');
      updateSettings({ voiceButtonEnabled: !settings.voiceButtonEnabled });
    }
    setLastTap(now);
  };

  const handleExecuteSearch = useCallback(async () => {
    if (searchQuery.trim()) {
      console.log('Executing command from HomePage:', searchQuery);

      const isCommand = await executeVoiceCommand(
        searchQuery,
        undefined,
        settings.customVoiceCommands,
        settings.appLanguage || 'ca-ES',
        addNote,
        undefined,
        tags,
        settings.weatherLocation,
        undefined,
        undefined,
        navigateToNotes,
        addToList,
        notes,
        undefined, // speakText
        undefined, // activateMicrophone
        undefined, // waitForConfirmation
        updateNote
      );

      if (!isCommand) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        try {
          const canOpen = await Linking.canOpenURL(searchUrl);
          if (canOpen) {
            await Linking.openURL(searchUrl);
          }
        } catch (error) {
          console.error('Error opening search:', error);
        }
      }

      setSearchQuery('');
      setShowSearchResults(false);
      setIsSearching(false);
      Keyboard.dismiss();
    }
  }, [searchQuery, settings.customVoiceCommands, settings.appLanguage, tags, settings.weatherLocation, addNote, navigateToNotes, addToList]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(backgroundColor);
    }
  }, [backgroundColor]);

  const containerContent = (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 50 : 0}
    >
      <View style={{ flex: 1, backgroundColor: settings.backgroundImage ? 'transparent' : backgroundColor }}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <View
          style={[
            styles.container,
            settings.backgroundImage && styles.containerTransparent,
            !settings.backgroundImage && settings.screenBackgroundColor && { backgroundColor: settings.screenBackgroundColor },
            !settings.backgroundImage && !settings.screenBackgroundColor && { backgroundColor: isDarkMode ? Colors.dark.background : '#f5f5f5' }
          ]}
        >
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, isLandscape && styles.contentLandscape]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={showSearchResults}
        nestedScrollEnabled={true}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={handleDoubleTap}
          onLongPress={handleEmptySpaceLongPress}
          delayLongPress={500}
        >
        {!showSearchResults && settings.showClock && isPageVisible && (
          <Animated.View style={[
            styles.timeContainer,
            isLandscape && styles.timeContainerLandscape,
            currentClockPosition === 'left' && styles.timeContainerLeft,
            currentClockPosition === 'right' && styles.timeContainerRight,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateX: vibrationAnim },
                { translateY: slideDownAnim },
              ],
            }
          ]}>
            <TouchableOpacity
              onPress={() => {
                handleClockPressWithEffects();
                handleClockDoublePress();
              }}
              activeOpacity={0.7}
            >
              <Animated.Text style={[
                styles.time,
                isLandscape && styles.timeLandscape,
                {
                  fontSize: clockSizeMap[currentClockSize].fontSize,
                  color: isPhoneSilent && settings.dynamicClockEnabled ? '#FFD700' : clockTextColor,
                  opacity: blinkAnim,
                  textShadowColor: 'rgba(0, 0, 0, 0.8)',
                  textShadowOffset: { width: 2, height: 2 },
                  textShadowRadius: 3,
                }
              ]}>
                {currentTime.toLocaleTimeString(settings.appLanguage || 'ca-ES', { hour: '2-digit', minute: '2-digit' })}
              </Animated.Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                handleDatePress();
                handleClockDoublePress();
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.date,
                isLandscape && styles.dateLandscape,
                {
                  fontSize: clockSizeMap[currentClockSize].dateSize + 4,
                  color: dateTextColor,
                  textShadowColor: 'rgba(0, 0, 0, 0.8)',
                  textShadowOffset: { width: 2, height: 2 },
                  textShadowRadius: 3,
                }
              ]}>
                {currentTime.toLocaleDateString(settings.appLanguage || 'ca-ES', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {!showSearchResults && (
        <View style={[styles.shortcutsContainer, isLandscape && styles.shortcutsContainerLandscape, { zIndex: 10 }]}>
          {showAppIcons && isPageVisible && (
          <Animated.View style={[
            styles.shortcutsGrid,
            isLandscape && styles.shortcutsGridLandscape,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}>
            {homeScreenShortcuts.map((shortcut) => {
              const IconComponent = getIcon(shortcut.icon);
              const iconSize = iconSizeMap[currentIconSize];
              const iconRadius = iconRadiusMap[currentIconStyle];
              const systemEmoji = getSystemIconEmoji(shortcut.icon);

              return (
                <TouchableOpacity
                  key={shortcut.id}
                  style={[styles.shortcut, { width: iconWidth }]}
                  onPress={() => handleAppPress(shortcut)}
                  onLongPress={() => handleAppLongPress(shortcut)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.shortcutIcon,
                    {
                      width: iconSize.container,
                      height: iconSize.container,
                      backgroundColor: settings.useSystemIcons ? 'transparent' : currentAccentColor + '20',
                      borderColor: settings.useSystemIcons ? 'transparent' : currentAccentColor + '40',
                      borderWidth: settings.useSystemIcons ? 0 : 1,
                    },
                    currentIconStyle === 'teardrop'
                      ? getTeardropBorderRadius(iconSize.container)
                      : { borderRadius: iconRadius }
                  ]}>
                    {settings.useSystemIcons ? (
                      <Text style={{ fontSize: iconSize.icon + 8 }}>{systemEmoji}</Text>
                    ) : (
                      <IconComponent size={iconSize.icon} color={currentAccentColor} />
                    )}
                  </View>
                  {settings.showIconLabels && showAppLabels && (
                    <Text style={[styles.shortcutLabel, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]} numberOfLines={1}>
                      {shortcut.name}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
          )}
        </View>
        )}

        {!showSearchResults && (
        <View style={[styles.tagsContainer, isLandscape && styles.tagsContainerLandscape, { zIndex: 9 }]}>
          {isPageVisible && (
          <Animated.View style={[
            styles.tagsGrid,
            isLandscape && styles.tagsGridLandscape,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}>
            {(settings.showCalendarEvents !== false) && calendarEvents.map((event) => {
              const tagSize = tagSizeMap[currentTagSize];
              const eventDate = event.startDate.toLocaleDateString(settings.appLanguage || 'ca-ES', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });
              return (
                <TouchableOpacity
                  key={`calendar-${event.id}`}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: '#ec4899' + Math.round(currentTagOpacity * 255).toString(16).padStart(2, '0'),
                      borderWidth: 0,
                      paddingHorizontal: tagSize.paddingH,
                      paddingVertical: tagSize.paddingV,
                    }
                  ]}
                  onPress={async () => {
                    try {
                      const calendarUrl = Platform.select({
                        ios: 'calshow://',
                        android: 'content://com.android.calendar/time/',
                        default: 'calendar://'
                      });
                      if (calendarUrl) {
                        const canOpen = await Linking.canOpenURL(calendarUrl);
                        if (canOpen) {
                          await Linking.openURL(calendarUrl);
                        }
                      }
                    } catch (error) {
                      console.error('Error opening calendar:', error);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={eventScrollViewStyle}
                  >
                    <Text style={[styles.tagLabel, { fontSize: tagSize.fontSize, color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                      {event.title} • {eventDate}
                    </Text>
                  </ScrollView>
                </TouchableOpacity>
              );
            })}
            {showAppLabels && tags.filter(isTagVisible).map((tag) => {
              const tagSize = tagSizeMap[currentTagSize];
              const textColor = isTagDark ? Colors.dark.text : '#1a1a1a';
              const borderOpacity = currentTagOpacity * 0.4;
              const opacityHex = Math.round(currentTagOpacity * 255).toString(16).padStart(2, '0');
              const borderOpacityHex = Math.round(borderOpacity * 255).toString(16).padStart(2, '0');
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: tagBackgroundColor + opacityHex,
                      borderColor: textColor + borderOpacityHex,
                      borderWidth: 1,
                      paddingHorizontal: tagSize.paddingH,
                      paddingVertical: tagSize.paddingV,
                      borderRadius: 16,
                    }
                  ]}
                  onPress={() => handleTagPress(tag)}
                  onLongPress={() => handleTagLongPress(tag)}
                  activeOpacity={0.7}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'center' }}
                  >
                    <Text style={[styles.tagLabel, { fontSize: tagSize.fontSize, color: textColor }]}>{tag.label}</Text>
                  </ScrollView>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
          )}
        </View>
        )}

        {showSearchResults && searchQuery.trim().length > 0 && (
          <View style={[styles.searchResultsContainer, { backgroundColor: isDarkMode ? 'rgba(45, 45, 45, 0.75)' : 'rgba(255, 255, 255, 0.75)' }]}>
            <ScrollView
              style={styles.searchResultsScroll}
              contentContainerStyle={styles.searchResultsContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              nestedScrollEnabled={true}
            >
              {(() => {
                const query = searchQuery.toLowerCase().trim();

                const matchesSearchQuery = (text: string, query: string): boolean => {
                  if (!query) return true;

                  const textLower = text.toLowerCase();
                  const queryWords = query.split(/\s+/).filter(w => w.length > 0);

                  // Split text into words
                  const textWords = textLower.split(/\s+/).filter(w => w.length > 0);

                  // For each starting position in text words
                  for (let i = 0; i < textWords.length; i++) {
                    let matched = true;
                    let textIndex = i;

                    // Try to match all query words consecutively
                    for (let j = 0; j < queryWords.length; j++) {
                      if (textIndex >= textWords.length) {
                        matched = false;
                        break;
                      }

                      // Check if the text word starts with the query word
                      if (!textWords[textIndex].startsWith(queryWords[j])) {
                        matched = false;
                        break;
                      }

                      textIndex++;
                    }

                    if (matched) return true;
                  }

                  return false;
                };

                const filteredApps = allApps.filter(app =>
                  matchesSearchQuery(app.name, query)
                );

                const filteredContacts = allApps.filter(app =>
                  app.type === 'contact' && matchesSearchQuery(app.name, query)
                );

                const filteredTags = tags.filter(tag =>
                  matchesSearchQuery(tag.label, query) ||
                  (tag.command && matchesSearchQuery(tag.command, query))
                );

                const filteredNotes = notes.filter(note => {
                  if (note.isPrivate) return false;
                  if (matchesSearchQuery(note.content, query)) return true;
                  if (note.type === 'list' && note.listItems) {
                    return note.listItems.some(item => matchesSearchQuery(item.text, query));
                  }
                  return false;
                });

                const customCommandsFiltered = (settings.customVoiceCommands || []).filter(cmd => {
                  try {
                    const pattern = new RegExp(cmd.pattern, 'i');
                    return pattern.test(query);
                  } catch {
                    return false;
                  }
                });

                const commandPatterns = [
                  { pattern: /^quin temps fa/i, name: 'Quin temps fa', category: 'weather', isCustom: false },
                  { pattern: /^quin temps farà/i, name: 'Quin temps farà', category: 'weather', isCustom: false },
                  { pattern: /^obre|obrir/i, name: 'Obre aplicació', category: 'app', isCustom: false },
                  { pattern: /^cerca|cercar/i, name: 'Cerca a Google', category: 'search', isCustom: false },
                  { pattern: /^envia|enviar/i, name: 'Envia missatge/correu', category: 'message', isCustom: false },
                  { pattern: /^truca|trucar/i, name: 'Truca', category: 'call', isCustom: false },
                  { pattern: /^reprodueix/i, name: 'Reprodueix música/vídeo', category: 'media', isCustom: false },
                  { pattern: /^programa/i, name: 'Programa alarma', category: 'alarm', isCustom: false },
                  { pattern: /^crea/i, name: 'Crea esdeveniment/nota', category: 'create', isCustom: false },
                  { pattern: /^apunta|afegeix/i, name: 'Apunta nota', category: 'note', isCustom: false },
                  { pattern: /^navegar|guia'm/i, name: 'Navega fins a', category: 'navigation', isCustom: false },
                ];

                const filteredCommands = commandPatterns.filter(cmd =>
                  matchesSearchQuery(cmd.name, query)
                );

                const filteredCustomCommands = customCommandsFiltered.map(cmd => ({
                  pattern: new RegExp(cmd.pattern, 'i'),
                  name: cmd.name,
                  category: 'custom',
                  isCustom: true,
                  id: cmd.id,
                  commandData: cmd,
                }));

                const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                const filteredEmails = emailPattern.test(query) ? [query] : [];

                const totalResults = filteredApps.length + filteredContacts.length + filteredTags.length + filteredCommands.length + filteredCustomCommands.length + filteredEmails.length + filteredNotes.length;

                if (totalResults === 0) {
                  return (
                    <View style={styles.noResultsContainer}>
                      <Icons.Search size={48} color={isDarkMode ? Colors.dark.textSecondary : '#999'} />
                      <Text style={[styles.noResultsText, { color: isDarkMode ? Colors.dark.textSecondary : '#999' }]}>
                        {t('noResults') || 'No s\'han trobat resultats'}
                      </Text>
                    </View>
                  );
                }

                return (
                  <>
                    {filteredApps.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredApps.map((app) => {
                          const IconComponent = getIcon(app.icon);
                          const systemEmoji = getSystemIconEmoji(app.icon);

                          return (
                            <TouchableOpacity
                              key={app.id}
                              style={styles.searchResultItem}
                              onPress={() => {
                                handleAppPress(app);
                              }}
                              onLongPress={() => {
                                setSelectedSearchItem({ type: 'app', data: app });
                                setShowSearchItemMenu(true);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[
                                styles.searchResultItemIcon,
                                {
                                  backgroundColor: settings.useSystemIcons ? 'transparent' : currentAccentColor + '15',
                                }
                              ]}>
                                {settings.useSystemIcons ? (
                                  <Text style={{ fontSize: 32 }}>{systemEmoji}</Text>
                                ) : (
                                  <IconComponent size={24} color={currentAccentColor} />
                                )}
                              </View>
                              <View style={styles.searchResultTextContainer}>
                                <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                                  {app.name}
                                </Text>
                                {app.packageName && (
                                  <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                    {app.packageName}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {filteredContacts.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredContacts.map((contact) => {
                          return (
                            <TouchableOpacity
                              key={contact.id}
                              style={styles.searchResultItem}
                              onPress={() => {
                                handleAppPress(contact);
                              }}
                              onLongPress={() => {
                                setSelectedSearchItem({ type: 'contact', data: contact });
                                setShowSearchItemMenu(true);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[
                                styles.searchResultItemIcon,
                                { backgroundColor: '#E0E0E0' }
                              ]}>
                                <Icons.User size={24} color={isDarkMode ? Colors.dark.text : '#666'} />
                              </View>
                              <View style={styles.searchResultTextContainer}>
                                <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                                  {contact.name}
                                </Text>
                                {contact.packageName && (
                                  <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                    {contact.packageName}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {filteredEmails.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredEmails.map((email, index) => (
                          <TouchableOpacity
                            key={`email-${index}`}
                            style={styles.searchResultItem}
                            onPress={async () => {
                              const mailUrl = `mailto:${email}`;
                              try {
                                const canOpen = await Linking.canOpenURL(mailUrl);
                                if (canOpen) {
                                  await Linking.openURL(mailUrl);
                                }
                              } catch (error) {
                                console.error('Error opening email:', error);
                              }
                            }}
                            onLongPress={() => {
                              setSelectedSearchItem({ type: 'email', data: email });
                              setShowSearchItemMenu(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.searchResultItemIcon,
                              { backgroundColor: currentAccentColor + '15' }
                            ]}>
                              <Icons.Mail size={24} color={currentAccentColor} />
                            </View>
                            <View style={styles.searchResultTextContainer}>
                              <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                                {email}
                              </Text>
                              <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                {t('sendEmail') || 'Envia correu'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {filteredTags.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredTags.map((tag) => {
                          return (
                            <TouchableOpacity
                              key={tag.id}
                              style={styles.searchResultItem}
                              onPress={() => {
                                handleTagPress(tag);
                              }}
                              onLongPress={() => {
                                setSelectedSearchItem({ type: 'tag', data: tag });
                                setShowSearchItemMenu(true);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[
                                styles.searchResultItemIcon,
                                { backgroundColor: currentAccentColor + '15' }
                              ]}>
                                <Icons.Tag size={24} color={currentAccentColor} />
                              </View>
                              <View style={styles.searchResultTextContainer}>
                                <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                                  {tag.label}
                                </Text>
                                {tag.command && (
                                  <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                    {tag.command}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {filteredCommands.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredCommands.map((cmd, index) => (
                          <TouchableOpacity
                            key={`cmd-${index}`}
                            style={styles.searchResultItem}
                            onPress={async () => {
                              const fullCommand = cmd.name;
                              await executeVoiceCommand(
                                fullCommand,
                                undefined,
                                settings.customVoiceCommands,
                                settings.appLanguage || 'ca-ES',
                                undefined,
                                undefined,
                                tags,
                                settings.weatherLocation,
                                undefined,
                                undefined,
                                undefined,
                                undefined,
                                notes,
                                undefined,
                                undefined,
                                undefined,
                                updateNote
                              );
                            }}
                            onLongPress={() => {
                              setSelectedSearchItem({ type: 'command', data: cmd });
                              setShowSearchItemMenu(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.searchResultItemIcon,
                              { backgroundColor: currentAccentColor + '15' }
                            ]}>
                              <Icons.Zap size={24} color={currentAccentColor} />
                            </View>
                            <View style={styles.searchResultTextContainer}>
                              <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                                {cmd.name}
                              </Text>
                              <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                {t(`category_${cmd.category}`) || cmd.category}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {filteredNotes.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredNotes.map((note) => {
                          return (
                            <TouchableOpacity
                              key={note.id}
                              style={styles.searchResultItem}
                              onPress={() => {
                                if (navigateToNotes && setNotesSearchFilter) {
                                  setNotesSearchFilter(query);
                                  navigateToNotes(query);
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[
                                styles.searchResultItemIcon,
                                { backgroundColor: currentAccentColor + '15' }
                              ]}>
                                <Icons.FileText size={24} color={currentAccentColor} />
                              </View>
                              <View style={styles.searchResultTextContainer}>
                                <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]} numberOfLines={1}>
                                  {note.content || t('note')}
                                </Text>
                                {note.type === 'list' && (
                                  <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                    {t('list')}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {filteredCustomCommands.length > 0 && (
                      <View style={styles.searchResultSection}>
                        {filteredCustomCommands.map((cmd, index) => (
                          <TouchableOpacity
                            key={`custom-cmd-${index}`}
                            style={styles.searchResultItem}
                            onPress={async () => {
                              if (cmd.commandData) {
                                const cmdData = cmd.commandData;
                                if (cmdData.action === 'open_url') {
                                  await Linking.openURL(cmdData.actionData);
                                } else if (cmdData.action === 'open_app') {
                                  await Linking.openURL(cmdData.actionData);
                                }
                              }
                            }}
                            onLongPress={() => {
                              setSelectedSearchItem({ type: 'command', data: cmd });
                              setShowSearchItemMenu(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.searchResultItemIcon,
                              { backgroundColor: currentAccentColor + '15' }
                            ]}>
                              <Icons.Command size={24} color={currentAccentColor} />
                            </View>
                            <View style={styles.searchResultTextContainer}>
                              <Text style={[styles.searchResultTitle, { color: isDarkMode ? Colors.dark.text : '#1a1a1a' }]}>
                                {cmd.name}
                              </Text>
                              <Text style={[styles.searchResultSubtitle, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]} numberOfLines={1}>
                                {t('customCommand') || 'Ordre personalitzada'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        )}
        </Pressable>
      </ScrollView>
      </View>

      <Modal
        visible={showShortcutModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowShortcutModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isTagDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isTagDark ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isTagDark ? Colors.dark.text : Colors.light.text }]}>{t('newShortcut')}</Text>
              <TouchableOpacity onPress={() => setShowShortcutModal(false)} activeOpacity={0.7}>
                <Icons.X size={24} color={isTagDark ? Colors.dark.text : Colors.light.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isTagDark ? Colors.dark.background : Colors.light.background,
                color: isTagDark ? Colors.dark.text : Colors.light.text,
                borderColor: isTagDark ? Colors.dark.border : Colors.light.border,
              }]}
              value={shortcutName}
              onChangeText={setShortcutName}
              placeholder={t('appName')}
              placeholderTextColor={isTagDark ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalButton, !shortcutName.trim() && styles.modalButtonDisabled]}
              onPress={handleAddShortcut}
              disabled={!shortcutName.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonText}>{t('add')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTagModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTagModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isTagDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: isTagDark ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isTagDark ? Colors.dark.text : Colors.light.text }]}>{t('newTag')}</Text>
              <TouchableOpacity onPress={() => setShowTagModal(false)} activeOpacity={0.7}>
                <Icons.X size={24} color={isTagDark ? Colors.dark.text : Colors.light.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isTagDark ? Colors.dark.background : Colors.light.background,
                color: isTagDark ? Colors.dark.text : Colors.light.text,
                borderColor: isTagDark ? Colors.dark.border : Colors.light.border,
              }]}
              value={tagLabel}
              onChangeText={setTagLabel}
              placeholder={t('tag')}
              placeholderTextColor={isTagDark ? Colors.dark.textSecondary : Colors.light.textSecondary}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isTagDark ? Colors.dark.background : Colors.light.background,
                color: isTagDark ? Colors.dark.text : Colors.light.text,
                borderColor: isTagDark ? Colors.dark.border : Colors.light.border,
              }]}
              value={tagCommand}
              onChangeText={setTagCommand}
              placeholder={t('command')}
              placeholderTextColor={isTagDark ? Colors.dark.textSecondary : Colors.light.textSecondary}
            />
            <TouchableOpacity
              style={[styles.modalButton, (!tagLabel.trim() || !tagCommand.trim()) && styles.modalButtonDisabled]}
              onPress={handleAddTag}
              disabled={!tagLabel.trim() || !tagCommand.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonText}>{t('add')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LauncherModeSelector
        visible={showModeSelector}
        onClose={() => setShowModeSelector(false)}
        onOpenBasicSettings={() => setShowBasicSettings(true)}
        onOpenAdvancedSettings={() => setShowSettings(true)}
      />

      <Modal
        visible={showSettings}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSettings(false)}
      >
        <SettingsPage onClose={() => setShowSettings(false)} />
      </Modal>

      <Modal
        visible={showBasicSettings}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowBasicSettings(false)}
      >
        <SettingsPageBasic onClose={() => setShowBasicSettings(false)} />
      </Modal>

      <Modal
        visible={showHelpPage}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowHelpPage(false)}
      >
        <HelpPage onClose={() => setShowHelpPage(false)} />
      </Modal>

      <Modal
        visible={showAppDrawer}
        animationType="none"
        transparent={true}
        onRequestClose={closeAppDrawerWithAnimation}
      >
        <View style={styles.appDrawerBackdrop}>
        <Animated.View style={[
          styles.appDrawerContainer,
          {
            transform: [{ translateY: drawerTranslateY }]
          }
        ]}>
          <View style={styles.appDrawerHandle}>
            <View style={styles.appDrawerHandlebar} />
          </View>
          <View style={styles.appDrawerHeader}>
            <Text style={styles.appDrawerTitle}>{t('selectAppToAdd') || 'Selecciona app per afegir'}</Text>
            <TouchableOpacity onPress={() => {
              setAddingAppToHome(true);
              setMultiSelectMode(false);
              setSelectedApps(new Set());
              closeAppDrawerWithAnimation();
            }} activeOpacity={0.7}>
              <Icons.X size={32} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>
          {multiSelectMode && selectedApps.size > 0 && (
            <View style={[styles.multiSelectBar, { backgroundColor: Colors.dark.surface, borderBottomColor: Colors.dark.border }]}>
              <Text style={[styles.multiSelectText, { color: Colors.dark.text }]}>
                {selectedApps.size} {selectedApps.size === 1 ? 'aplicació seleccionada' : 'aplicacions seleccionades'}
              </Text>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: currentAccentColor }]}
                onPress={async () => {
                  for (const appId of selectedApps) {
                    await updateShortcut(appId, { onHomeScreen: true });
                  }
                  setSelectedApps(new Set());
                  setMultiSelectMode(false);
                  setAddingAppToHome(true);
                  closeAppDrawerWithAnimation();
                }}
                activeOpacity={0.7}
              >
                <Icons.Check size={20} color="#ffffff" />
                <Text style={styles.confirmButtonText}>Afegir</Text>
              </TouchableOpacity>
            </View>
          )}
          <ScrollView
            style={styles.appDrawerScroll}
            contentContainerStyle={styles.appDrawerContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.appDrawerGrid}>
              {allApps.map((app) => {
                const IconComponent = getIcon(app.icon);
                const iconSize = iconSizeMap[currentIconSize];
                const iconRadius = iconRadiusMap[currentIconStyle];
                const systemEmoji = getSystemIconEmoji(app.icon);

                return (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.shortcut}
                    onPress={async () => {
                      if (multiSelectMode) {
                        const newSelected = new Set(selectedApps);
                        if (newSelected.has(app.id)) {
                          newSelected.delete(app.id);
                        } else {
                          newSelected.add(app.id);
                        }
                        setSelectedApps(newSelected);
                      } else {
                        setSelectedDrawerApp(app);
                        setShowDrawerAppMenu(true);
                      }
                    }}
                    onLongPress={() => {
                      if (multiSelectMode) {
                        const newSelected = new Set(selectedApps);
                        if (newSelected.has(app.id)) {
                          newSelected.delete(app.id);
                        } else {
                          newSelected.add(app.id);
                        }
                        setSelectedApps(newSelected);
                      } else {
                        setSelectedDrawerApp(app);
                        setShowDrawerAppMenu(true);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.appIconContainer}>
                      <View style={[
                        styles.shortcutIcon,
                        {
                          width: iconSize.container,
                          height: iconSize.container,
                          backgroundColor: settings.useSystemIcons ? 'transparent' : currentAccentColor + '20',
                          borderColor: settings.useSystemIcons ? 'transparent' : currentAccentColor + '40',
                          borderWidth: settings.useSystemIcons ? 0 : 1,
                        },
                        currentIconStyle === 'teardrop'
                          ? getTeardropBorderRadius(iconSize.container)
                          : { borderRadius: iconRadius }
                      ]}>
                        {settings.useSystemIcons ? (
                          <Text style={{ fontSize: iconSize.icon + 8 }}>{systemEmoji}</Text>
                        ) : (
                          <IconComponent size={iconSize.icon} color={currentAccentColor} />
                        )}
                      </View>
                      {multiSelectMode && (
                        <View style={[styles.checkboxContainer, { backgroundColor: Colors.dark.background }]}>
                          {selectedApps.has(app.id) ? (
                            <View style={[styles.checkbox, styles.checkboxSelected, { backgroundColor: currentAccentColor }]}>
                              <Icons.Check size={14} color="#ffffff" />
                            </View>
                          ) : (
                            <View style={[styles.checkbox, { borderColor: Colors.dark.border }]} />
                          )}
                        </View>
                      )}
                    </View>
                    <Text style={styles.shortcutLabel} numberOfLines={1}>
                      {app.name}
                    </Text>
                    {app.onHomeScreen && (
                      <View style={styles.homeScreenBadge}>
                        <Icons.Home size={10} color={currentAccentColor} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showAppMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAppMenu(false)}
      >
        <TouchableOpacity
          style={styles.appMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowAppMenu(false)}
        >
          <View style={styles.appMenuContent}>
            {selectedApp && (
              <>
                <View style={styles.appMenuHeader}>
                  <View style={[
                    styles.appMenuIcon,
                    {
                      backgroundColor: currentAccentColor + '20',
                      borderColor: currentAccentColor + '40',
                    }
                  ]}>
                    {(() => {
                      const IconComponent = getIcon(selectedApp.icon);
                      return <IconComponent size={32} color={currentAccentColor} />;
                    })()}
                  </View>
                  <Text style={styles.appMenuTitle}>{selectedApp.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={handleToggleHomeScreen}
                  activeOpacity={0.7}
                >
                  {selectedApp.onHomeScreen ? (
                    <>
                      <Icons.Minus size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('removeFromHome')}</Text>
                    </>
                  ) : (
                    <>
                      <Icons.Plus size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('addToHome')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    updateSettings({ showAppIcons: !settings.showAppIcons });
                    setShowAppMenu(false);
                    setSelectedApp(null);
                  }}
                  activeOpacity={0.7}
                >
                  {settings.showAppIcons === false ? (
                    <>
                      <Icons.Eye size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('showIcons')}</Text>
                    </>
                  ) : (
                    <>
                      <Icons.EyeOff size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('hideIcons')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    setShowAppMenu(false);
                    setSelectedApp(null);
                    setAddingAppToHome(true);
                    setMultiSelectMode(false);
                    setTimeout(() => {
                      openAppDrawerWithAnimation();
                    }, 300);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Plus size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>{t('addApp')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    if (selectedApp && selectedApp.packageName) {
                      showAlert(t('info'), `${selectedApp.name}\n\n${selectedApp.packageName}`, [
                        { text: 'OK', style: 'default' }
                      ]);
                    } else {
                      showAlert(t('info'), `${selectedApp?.name || ''}`, [
                        { text: 'OK', style: 'default' }
                      ]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Info size={20} color={Colors.dark.text} />
                   <Text style={styles.appMenuButtonText}>{t('details')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    setShowAppMenu(false);
                    setSelectedTag(null);
                    setPrefilledAppData({
                      name: selectedApp.name,
                      packageName: selectedApp.packageName || '',
                    });
                    setShowTagEditorModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Tag size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>{t('addTag')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.appMenuButton, styles.appMenuButtonDanger]}
                  onPress={() => {
                    setShowAppMenu(false);
                    handleDeleteShortcut(selectedApp.id, selectedApp.name);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Trash2 size={20} color="#ef4444" />
                  <Text style={[styles.appMenuButtonText, styles.appMenuButtonTextDanger]}>{t('deleteApp')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showDrawerAppMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDrawerAppMenu(false)}
      >
        <TouchableOpacity
          style={styles.appMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowDrawerAppMenu(false)}
        >
          <View style={styles.appMenuContent}>
            {selectedDrawerApp && (
              <>
                <View style={styles.appMenuHeader}>
                  <View style={[
                    styles.appMenuIcon,
                    {
                      backgroundColor: currentAccentColor + '20',
                      borderColor: currentAccentColor + '40',
                    }
                  ]}>
                    {(() => {
                      const IconComponent = getIcon(selectedDrawerApp.icon);
                      return <IconComponent size={32} color={currentAccentColor} />;
                    })()}
                  </View>
                  <Text style={styles.appMenuTitle}>{selectedDrawerApp.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={async () => {
                    if (selectedDrawerApp) {
                      await updateShortcut(selectedDrawerApp.id, { onHomeScreen: true });
                      setShowDrawerAppMenu(false);
                      setSelectedDrawerApp(null);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Plus size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>Afegir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    setShowDrawerAppMenu(false);
                    setMultiSelectMode(true);
                    setSelectedDrawerApp(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.CheckSquare size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>Més seleccions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    if (selectedDrawerApp && selectedDrawerApp.packageName) {
                      showAlert(t('info'), `${selectedDrawerApp.name}\n\n${selectedDrawerApp.packageName}`, [
                        { text: 'OK', style: 'default' }
                      ]);
                    } else {
                      showAlert(t('info'), `${selectedDrawerApp?.name || ''}`, [
                        { text: 'OK', style: 'default' }
                      ]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Info size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>Detalls</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.appMenuButton, styles.appMenuButtonDanger]}
                  onPress={() => {
                    setShowDrawerAppMenu(false);
                    handleDeleteShortcut(selectedDrawerApp.id, selectedDrawerApp.name);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Trash2 size={20} color="#ef4444" />
                  <Text style={[styles.appMenuButtonText, styles.appMenuButtonTextDanger]}>{t('deleteApp')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <TagEditorModal
        visible={showTagEditorModal}
        onClose={() => {
          setShowTagEditorModal(false);
          setSelectedTag(null);
          setPrefilledAppData(undefined);
        }}
        onSave={handleSaveTagFromEditor}
        existingTag={selectedTag || undefined}
        prefilledAppData={prefilledAppData}
      />

      <Modal
        visible={showTagMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTagMenu(false)}
      >
        <TouchableOpacity
          style={styles.appMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowTagMenu(false)}
        >
          <View style={styles.appMenuContent}>
            {selectedTag && (
              <>
                <View style={styles.appMenuHeader}>
                  <Text style={styles.appMenuTitle}>{selectedTag.label}</Text>
                </View>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    setShowTagMenu(false);
                    setShowTagEditorModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Edit size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>{t('editTag') || 'Editar etiqueta'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    updateSettings({ showAppIcons: !settings.showAppIcons });
                    setShowTagMenu(false);
                    setSelectedTag(null);
                  }}
                  activeOpacity={0.7}
                >
                  {settings.showAppIcons === false ? (
                    <>
                      <Icons.Eye size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('showIcons')}</Text>
                    </>
                  ) : (
                    <>
                      <Icons.EyeOff size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('hideIcons')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.appMenuButton}
                  onPress={() => {
                    setShowTagMenu(false);
                    setSelectedTag(null);
                    setShowTagEditorModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Plus size={20} color={Colors.dark.text} />
                  <Text style={styles.appMenuButtonText}>{t('addTag') || 'Afegir etiqueta'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.appMenuButton, styles.appMenuButtonDanger]}
                  onPress={() => {
                    setShowTagMenu(false);
                    handleDeleteTag(selectedTag.id, selectedTag.label);
                    setSelectedTag(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Icons.Trash2 size={20} color="#ef4444" />
                  <Text style={[styles.appMenuButtonText, styles.appMenuButtonTextDanger]}>{t('delete')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showSearchItemMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSearchItemMenu(false)}
      >
        <TouchableOpacity
          style={styles.appMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowSearchItemMenu(false)}
        >
          <View style={styles.appMenuContent}>
            {selectedSearchItem && (
              <>
                <View style={styles.appMenuHeader}>
                  <Text style={styles.appMenuTitle}>
                    {selectedSearchItem.type === 'app' || selectedSearchItem.type === 'contact'
                      ? selectedSearchItem.data.name
                      : selectedSearchItem.type === 'tag'
                      ? selectedSearchItem.data.label
                      : selectedSearchItem.type === 'command'
                      ? selectedSearchItem.data.name
                      : selectedSearchItem.data}
                  </Text>
                </View>

                {(selectedSearchItem.type === 'app' || selectedSearchItem.type === 'contact') && (
                  <>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={() => {
                        handleAppPress(selectedSearchItem.data);
                        setShowSearchItemMenu(false);
                        setSearchQuery('');
                        setIsSearching(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.ExternalLink size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('open') || 'Obre'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={async () => {
                        await updateShortcut(selectedSearchItem.data.id, { onHomeScreen: !selectedSearchItem.data.onHomeScreen });
                        setShowSearchItemMenu(false);
                      }}
                      activeOpacity={0.7}
                    >
                      {selectedSearchItem.data.onHomeScreen ? (
                        <>
                          <Icons.Minus size={20} color={Colors.dark.text} />
                          <Text style={styles.appMenuButtonText}>{t('removeFromHome')}</Text>
                        </>
                      ) : (
                        <>
                          <Icons.Plus size={20} color={Colors.dark.text} />
                          <Text style={styles.appMenuButtonText}>{t('addToHome')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={() => {
                        setShowSearchItemMenu(false);
                        setSelectedTag(null);
                        setPrefilledAppData({
                          name: selectedSearchItem.data.name,
                          packageName: selectedSearchItem.data.packageName || '',
                        });
                        setShowTagEditorModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Tag size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('addTag')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={() => {
                        if (selectedSearchItem.data && selectedSearchItem.data.packageName) {
                          showAlert(t('info'), `${selectedSearchItem.data.name}\n\n${selectedSearchItem.data.packageName}`, [
                            { text: 'OK', style: 'default' }
                          ]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Info size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('details')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.appMenuButton, styles.appMenuButtonDanger]}
                      onPress={() => {
                        setShowSearchItemMenu(false);
                        handleDeleteShortcut(selectedSearchItem.data.id, selectedSearchItem.data.name);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Trash2 size={20} color="#ef4444" />
                      <Text style={[styles.appMenuButtonText, styles.appMenuButtonTextDanger]}>{t('deleteApp')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedSearchItem.type === 'email' && (
                  <>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={async () => {
                        const mailUrl = `mailto:${selectedSearchItem.data}`;
                        try {
                          const canOpen = await Linking.canOpenURL(mailUrl);
                          if (canOpen) {
                            await Linking.openURL(mailUrl);
                          }
                        } catch (error) {
                          console.error('Error opening email:', error);
                        }
                        setShowSearchItemMenu(false);
                        setSearchQuery('');
                        setIsSearching(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Mail size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('sendEmail') || 'Envia correu'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={() => {
                        setShowSearchItemMenu(false);
                        showAlert(t('emailAddress') || 'Adreça de correu', selectedSearchItem.data, [
                          { text: 'OK', style: 'default' }
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Eye size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('show') || 'Mostrar'}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedSearchItem.type === 'tag' && (
                  <>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={() => {
                        handleTagPress(selectedSearchItem.data);
                        setShowSearchItemMenu(false);
                        setSearchQuery('');
                        setIsSearching(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Play size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('execute') || 'Executa'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={() => {
                        setShowSearchItemMenu(false);
                        setSelectedTag(selectedSearchItem.data);
                        setShowTagEditorModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Edit size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('editTag') || 'Editar etiqueta'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.appMenuButton, styles.appMenuButtonDanger]}
                      onPress={() => {
                        setShowSearchItemMenu(false);
                        handleDeleteTag(selectedSearchItem.data.id, selectedSearchItem.data.label);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Trash2 size={20} color="#ef4444" />
                      <Text style={[styles.appMenuButtonText, styles.appMenuButtonTextDanger]}>{t('delete')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedSearchItem.type === 'command' && (
                  <>
                    <TouchableOpacity
                      style={styles.appMenuButton}
                      onPress={async () => {
                        const cmdData = selectedSearchItem.data;
                        if (cmdData.isCustom && cmdData.commandData) {
                          const cmd = cmdData.commandData;
                          if (cmd.action === 'open_url') {
                            await Linking.openURL(cmd.actionData);
                          } else if (cmd.action === 'open_app') {
                            await Linking.openURL(cmd.actionData);
                          }
                        } else {
                          const fullCommand = cmdData.name;
                          await executeVoiceCommand(
                            fullCommand,
                            undefined,
                            settings.customVoiceCommands,
                            settings.appLanguage || 'ca-ES',
                            undefined,
                            undefined,
                            tags,
                            settings.weatherLocation,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            notes,
                            undefined,
                            undefined,
                            undefined,
                            updateNote
                          );
                        }
                        setShowSearchItemMenu(false);
                        setSearchQuery('');
                        setIsSearching(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icons.Play size={20} color={Colors.dark.text} />
                      <Text style={styles.appMenuButtonText}>{t('execute') || 'Executa'}</Text>
                    </TouchableOpacity>
                    {selectedSearchItem.data.isCustom && (
                      <>
                        <TouchableOpacity
                          style={styles.appMenuButton}
                          onPress={async () => {
                            const cmdData = selectedSearchItem.data.commandData;
                            if (cmdData && cmdData.id) {
                              await updateCustomCommand(cmdData.id, { onHomeScreen: !cmdData.onHomeScreen });
                            }
                            setShowSearchItemMenu(false);
                          }}
                          activeOpacity={0.7}
                        >
                          {selectedSearchItem.data.commandData?.onHomeScreen ? (
                            <>
                              <Icons.Minus size={20} color={Colors.dark.text} />
                              <Text style={styles.appMenuButtonText}>{t('removeFromHome')}</Text>
                            </>
                          ) : (
                            <>
                              <Icons.Plus size={20} color={Colors.dark.text} />
                              <Text style={styles.appMenuButtonText}>{t('addToHome')}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.appMenuButton}
                          onPress={() => {
                            setShowSearchItemMenu(false);
                            setShowSettings(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Icons.Edit size={20} color={Colors.dark.text} />
                          <Text style={styles.appMenuButtonText}>{t('edit') || 'Editar'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.appMenuButton, styles.appMenuButtonDanger]}
                          onPress={() => {
                            setShowSearchItemMenu(false);
                            showAlert(
                              t('deleteCommand') || 'Eliminar ordre',
                              `${t('deleteCommandConfirm') || 'Vols eliminar'} "${selectedSearchItem.data.name}"?`,
                              [
                                { text: t('cancel') || 'Cancel·lar', style: 'cancel' },
                                {
                                  text: t('delete') || 'Eliminar',
                                  style: 'destructive',
                                  onPress: () => {
                                    const cmdId = selectedSearchItem.data.id;
                                    if (cmdId) {
                                      deleteCustomCommand(cmdId);
                                    }
                                  }
                                },
                              ]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <Icons.Trash2 size={20} color="#ef4444" />
                          <Text style={[styles.appMenuButtonText, styles.appMenuButtonTextDanger]}>{t('delete') || 'Eliminar'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

          <View style={[styles.searchFooter, {
            backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff',
            borderTopColor: isDarkMode ? Colors.dark.border : '#e0e0e0',
            zIndex: 5,
          }]}>
            <TouchableOpacity
              style={styles.searchIcon}
              onPress={() => {
                searchInputRef.current?.focus();
              }}
              activeOpacity={0.7}
            >
              <Icons.Search size={20} color={isDarkMode ? Colors.dark.textSecondary : '#666'} />
            </TouchableOpacity>
           <TextInput
            ref={searchInputRef}
            style={[
             styles.searchInput,
            {
             color: isDarkMode ? Colors.dark.text : '#1a1a1a',
             backgroundColor: isDarkMode ? Colors.dark.background : '#f5f5f5',
             height: searchInputHeight,
            }
           ]}
           value={searchQuery}
           onChangeText={handleSearchInputChange}
           placeholder={t('searchOrExecute') || 'Cerca o executa...'}
           placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : '#999'}
           multiline
           maxLength={2000}
           showSoftInputOnFocus={true}
           onFocus={() => {
             setIsSearchFocused(true);
             if (searchQuery.trim().length > 0) {
               setIsSearching(true);
               setShowSearchResults(true);
             }
           }}
           onBlur={() => {
             setIsSearchFocused(false);
           }}
           onSubmitEditing={handleExecuteSearch}
           blurOnSubmit={false}
           onContentSizeChange={event => {
  // Ajusta l'alçada segons el contingut, però deixa que handleSearchInputChange 
  // restauri l'alçada original quan el text es buidi.
  const contentHeight = event.nativeEvent.contentSize.height;
  if (contentHeight > DEFAULT_INPUT_HEIGHT) {
    setSearchInputHeight(Math.max(DEFAULT_INPUT_HEIGHT, Math.min(100, contentHeight)));
  }
}}
         />
            <TouchableOpacity
              style={[styles.executeButton, !searchQuery.trim() && styles.executeButtonDisabled]}
              onPress={handleExecuteSearch}
              disabled={!searchQuery.trim()}
              activeOpacity={0.7}
            >
              <Icons.Send size={20} color={searchQuery.trim() ? currentAccentColor : (isDarkMode ? Colors.dark.textSecondary : '#999')} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const BackgroundImage = settings.backgroundImage ? (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: settings.backgroundImage }}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />
    </View>
  ) : null;

  return (
    <>
      {BackgroundImage}
      {containerContent}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  containerTransparent: {
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 80,
  },
  contentLandscape: {
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 60,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 'auto',
  },
  timeContainerLeft: {
    alignItems: 'flex-start',
  },
  timeContainerRight: {
    alignItems: 'flex-end',
  },
  timeContainerLandscape: {
    marginBottom: 24,
  },

  time: {
    fontSize: 72,
    fontWeight: '300' as const,
    letterSpacing: -2,
  },
  timeLandscape: {
    fontSize: 48,
  },
  date: {
    fontSize: 22,
    marginTop: -8,
    textTransform: 'capitalize',
  },
  dateLandscape: {
    fontSize: 18,
    marginTop: 4,
  },
  shortcutsContainer: {
    marginBottom: 12,
  },
  shortcutsContainerLandscape: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  shortcutsGridLandscape: {
    gap: 20,
    justifyContent: 'flex-start',
  },
  shortcut: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  shortcutIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  tagsContainer: {
    marginBottom: 12,
  },
  tagsContainerLandscape: {
    marginBottom: 16,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  tagsGridLandscape: {
    gap: 6,
  },
  tag: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tagLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  modalInput: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  appDrawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  appDrawerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '92%',
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  appDrawerHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  appDrawerHandlebar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
  },
  appDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  appDrawerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  appDrawerScroll: {
    flex: 1,
  },
  appDrawerContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  appDrawerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  homeScreenBadge: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  appMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  appMenuContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  appMenuHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  appMenuIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  appMenuTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  appMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
  },
  appMenuButtonDanger: {
    backgroundColor: '#ef444420',
  },
  appMenuButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  appMenuButtonTextDanger: {
    color: '#ef4444',
  },
  searchFooter: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2.5,
    gap: 12,
    borderTopWidth: 1,
  },
  searchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    fontSize: 16,
  },
  executeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executeButtonDisabled: {
    opacity: 0.5,
  },
  searchResultsContainer: {
    flex: 1,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 16,
    marginHorizontal: -16,
    overflow: 'hidden',
  },
  searchResultsScroll: {
    flex: 1,
  },
  searchResultsContent: {
    paddingBottom: 20,
  },
  searchResultSection: {
    marginBottom: 20,
  },
  searchResultSectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 12,
    opacity: 0.6,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 0,
    marginBottom: 0,
    gap: 12,
    backgroundColor: 'transparent',
  },
  searchResultItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultTagIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  appDrawerHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiSelectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  multiSelectText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  appIconContainer: {
    position: 'relative',
  },
  checkboxContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 12,
    padding: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderWidth: 0,
  },
});

function getColorBrightness(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

async function getImageBrightness(uri: string): Promise<number> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const img = new (window as any).Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(0.5);
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let r = 0, g = 0, b = 0;
          const pixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
          }

          r = r / pixels;
          g = g / pixels;
          b = b / pixels;

          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          resolve(brightness);
        } catch (error) {
          console.error('Error analyzing image:', error);
          resolve(0.5);
        }
      };
      img.onerror = () => resolve(0.5);
      img.src = uri;
    } else {
      resolve(0.5);
    }
  });
}
