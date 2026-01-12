import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Share, Platform, Alert, Modal, useColorScheme, KeyboardAvoidingView, Keyboard, StatusBar, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FileText, List, Share2, Volume2, Trash2, Check, X, Copy, Languages, Flag, Lock, Plus, Undo2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLauncher } from '@/contexts/LauncherContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Note } from '@/types';
import * as Speech from 'expo-speech';
import { useTranslations } from '@/constants/translations';
import { cleanTextForSpeech } from '@/utils/textUtils';
import { useNotesUndo } from '@/hooks/useNotesUndo';
import { findEmptyNote, isNoteEmpty } from '@/utils/noteUtils';

interface NotesPageProps {
  currentPage?: number;
  navigateToNotes?: (searchFilter?: string) => void;
}

export default function NotesPage({ currentPage, navigateToNotes }: NotesPageProps) {
  const { notes, addNote, updateNote, deleteNote, setIsEditingNote, setActiveNoteInput, notesSearchFilter, setNotesSearchFilter } = useLauncher();
  const { settings, updateSettings } = useSettings();
  const { t } = useTranslations(settings.appLanguage || 'ca-ES');
  const colorScheme = useColorScheme();
  const isDarkMode = settings.darkMode === 'system' ? (colorScheme === 'dark') : settings.darkMode;
  const [speakingNoteId, setSpeakingNoteId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const insets = useSafeAreaInsets();

  const newItemInputRefs = useRef<{ [key: string]: any }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinAction, setPinAction] = useState<'set' | 'verify' | 'view'>('set');
  const [isPrivateNotesUnlocked, setIsPrivateNotesUnlocked] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [scrollContentPaddingBottom, setScrollContentPaddingBottom] = useState(140);
  const [lastTap, setLastTap] = useState<number>(0);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);

  // Undo functionality
  const { pushUndo, popUndo, canUndo, hasUnsavedChanges, clearUndoStack, getUndoStack, trackEdit, clearNoteTracking } = useNotesUndo(notes);

  const handleUndo = useCallback(() => {
    const lastAction = popUndo();
    if (lastAction) {
      if (lastAction.type === 'delete') {
        // Restore deleted note
        addNote(lastAction.previousState);
      } else if (lastAction.type === 'edit') {
        // Restore previous edit state
        updateNote(lastAction.noteId, { 
          content: lastAction.previousState.content,
          listItems: lastAction.previousState.listItems 
        });
      } else if (lastAction.type === 'update') {
        // Restore previous state
        updateNote(lastAction.noteId, lastAction.previousState);
      } else if (lastAction.type === 'deleteItem' && lastAction.previousState.listItems) {
        // Restore deleted list item
        updateNote(lastAction.noteId, { listItems: lastAction.previousState.listItems });
      }
    }
  }, [popUndo, addNote, updateNote]);

  // Discard all changes (undo all deletions)
  const handleDiscardAllChanges = useCallback(() => {
    const stack = getUndoStack();
    // Apply all undo actions in reverse order (most recent first)
    for (let i = stack.length - 1; i >= 0; i--) {
      const action = stack[i];
      if (action.type === 'delete') {
        addNote(action.previousState);
      } else if (action.type === 'edit') {
        updateNote(action.noteId, { 
          content: action.previousState.content,
          listItems: action.previousState.listItems 
        });
      } else if (action.type === 'update') {
        updateNote(action.noteId, action.previousState);
      } else if (action.type === 'deleteItem' && action.previousState.listItems) {
        updateNote(action.noteId, { listItems: action.previousState.listItems });
      }
    }
    clearUndoStack();
  }, [getUndoStack, addNote, updateNote, clearUndoStack]);

  const handleShareNote = async (note: Note) => {
    try {
      let message = note.content;
      if (note.type === 'list' && note.listItems) {
        message += '\n\n' + note.listItems.map((item, i) => `${i + 1}. ${item.completed ? '[✓]' : '[ ]'} ${item.text}`).join('\n');
      }
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing note:', error);
    }
  };

  const handleSpeakNote = async (note: Note) => {
    if (speakingNoteId === note.id) {
      Speech.stop();
      setSpeakingNoteId(null);
      setIsSpeaking(false);
    } else {
      Speech.stop();
      setSpeakingNoteId(note.id);
      setIsSpeaking(true);
      
      let textToSpeak = note.content;
      if (note.type === 'list' && note.listItems && note.listItems.length > 0) {
        const itemsText = note.listItems.map(item => item.text).filter(text => text.trim()).join('. ');
        if (itemsText) {
          textToSpeak += '. ' + itemsText;
        }
      }
      
      // Clean Markdown symbols before speech synthesis
      const cleanedText = cleanTextForSpeech(textToSpeak);
      
      if (Platform.OS === 'web') {
        Speech.speak(cleanedText, {
          language: settings.speechLanguage || 'ca-ES',
          onDone: () => {
            setSpeakingNoteId(null);
            setIsSpeaking(false);
          },
          onStopped: () => {
            setSpeakingNoteId(null);
            setIsSpeaking(false);
          },
          onError: () => {
            setSpeakingNoteId(null);
            setIsSpeaking(false);
          },
        });
      } else {
        Speech.speak(cleanedText, {
          language: settings.speechLanguage || 'ca-ES',
          onDone: () => {
            setSpeakingNoteId(null);
            setIsSpeaking(false);
          },
          onStopped: () => {
            setSpeakingNoteId(null);
            setIsSpeaking(false);
          },
          onError: () => {
            setSpeakingNoteId(null);
            setIsSpeaking(false);
          },
        });
      }
    }
  };

  const handleDeleteNote = (noteId: string, noteContent: string) => {
    const noteToDelete = notes.find(n => n.id === noteId);
    Alert.alert(
      t('deleteNote'),
      t('deleteNoteConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('delete'), 
          style: 'destructive', 
          onPress: () => {
            if (speakingNoteId === noteId) {
              Speech.stop();
              setSpeakingNoteId(null);
              setIsSpeaking(false);
            }
            // Save state for undo before deleting
            if (noteToDelete) {
              pushUndo({ type: 'delete', noteId, previousState: { ...noteToDelete } });
            }
            deleteNote(noteId);
            // Clean up tracking data for deleted note
            clearNoteTracking(noteId);
          }
        },
      ],
      { cancelable: true }
    );
  };



  const handleCreateNote = () => {
    Keyboard.dismiss();
    
    // Check if there's already an empty note using utility function
    const existingEmptyNote = findEmptyNote(notes, 'note');
    
    if (existingEmptyNote) {
      // Focus on the existing empty note instead of creating a new one
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
      return;
    }
    
    const newNote: Note = {
      id: Date.now().toString(),
      content: '',
      createdAt: Date.now(),
      type: 'note',
      backgroundColor: settings.noteBackgroundColor || '#D4E5FF',
    };
    addNote(newNote);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  useEffect(() => {
    if (currentPage !== 0) {
      // Auto-save insertions and clean up empty notes before checking unsaved changes
      const emptyNoteIds: string[] = [];
      notes.forEach(note => {
        if (isNoteEmpty(note)) {
          emptyNoteIds.push(note.id);
        }
      });
      
      // Delete all empty notes
      // Note: React 18+ automatically batches these state updates
      if (emptyNoteIds.length > 0) {
        emptyNoteIds.forEach(noteId => {
          deleteNote(noteId);
        });
      }
      
      // Check for unsaved changes (deletions) before navigating away
      if (hasUnsavedChanges) {
        setShowUnsavedChangesModal(true);
        return;
      }
      
      Keyboard.dismiss();
      setIsEditingNote(false);
      setActiveNoteInput(null);
      setNotesSearchFilter('');
      setIsPrivateNotesUnlocked(false);
      clearUndoStack();
    }
  }, [currentPage, setNotesSearchFilter, setIsEditingNote, setActiveNoteInput, hasUnsavedChanges, clearUndoStack, notes, deleteNote]);

  // Keyboard shortcut for undo (Ctrl+Z / Cmd+Z) - Web only
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (canUndo) {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, handleUndo]);

  useEffect(() => {
    notes.forEach(note => {
      if (note.type === 'note' && note.backgroundColor !== settings.noteBackgroundColor) {
        updateNote(note.id, { backgroundColor: settings.noteBackgroundColor || '#D4E5FF' });
      } else if (note.type === 'list' && note.backgroundColor !== settings.listBackgroundColor) {
        updateNote(note.id, { backgroundColor: settings.listBackgroundColor || '#FFDAB9' });
      }
    });
  }, [settings.noteBackgroundColor, settings.listBackgroundColor]);

  const handleCreateList = () => {
    Keyboard.dismiss();
    
    // Check if there's already an empty list using utility function
    const existingEmptyList = findEmptyNote(notes, 'list');
    
    if (existingEmptyList) {
      // Focus on the existing empty list instead of creating a new one
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
      return;
    }
    
    const newNote: Note = {
      id: Date.now().toString(),
      content: '',
      createdAt: Date.now(),
      type: 'list',
      listItems: [],
      backgroundColor: settings.listBackgroundColor || '#FFDAB9',
    };
    addNote(newNote);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };



  const handleToggleListItem = (noteId: string, itemIndex: number) => {
    const note = notes.find(n => n.id === noteId);
    if (note && note.listItems) {
      const updatedItems = [...note.listItems];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], completed: !updatedItems[itemIndex].completed };
      updateNote(noteId, { listItems: updatedItems });
    }
  };

  const handleUpdateNoteContent = (noteId: string, content: string) => {
    const currentNote = notes.find(n => n.id === noteId);
    if (currentNote) {
      const updatedNote = { ...currentNote, content };
      trackEdit(noteId, currentNote, updatedNote);
    }
    updateNote(noteId, { content });
  };

  const handleFocusNote = (noteId: string, itemIndex?: number) => {
    setIsEditingNote(true);
    setActiveNoteInput({ noteId, itemIndex });
  };

  const handleBlurNoteContent = (noteId: string, content: string) => {
    if (!content.trim()) {
      const noteToDelete = notes.find(n => n.id === noteId);
      if (noteToDelete) {
        pushUndo({ type: 'delete', noteId, previousState: { ...noteToDelete } });
      }
      deleteNote(noteId);
      // Clean up tracking data for deleted note
      clearNoteTracking(noteId);
    }
  };

  const handleUpdateListTitle = (noteId: string, title: string) => {
    const currentNote = notes.find(n => n.id === noteId);
    if (currentNote) {
      const updatedNote = { ...currentNote, content: title };
      trackEdit(noteId, currentNote, updatedNote);
    }
    updateNote(noteId, { content: title });
  };

  const handleUpdateListItem = (noteId: string, itemIndex: number, text: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note && note.listItems) {
      const updatedItems = [...note.listItems];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], text };
      const updatedNote = { ...note, listItems: updatedItems };
      trackEdit(noteId, note, updatedNote);
      updateNote(noteId, { listItems: updatedItems });
    }
  };

  const handleAddListItem = (noteId: string, shouldFocus: boolean = true) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedItems = [...(note.listItems || []), { text: '', completed: false }];
      updateNote(noteId, { listItems: updatedItems });
      if (shouldFocus) {
        setTimeout(() => {
          newItemInputRefs.current[`${noteId}-${updatedItems.length - 1}`]?.focus();
        }, 100);
      }
    }
  };

  const handleListItemKeyPress = (noteId: string, itemIndex: number, text: string) => {
    if (text.trim()) {
      handleAddListItem(noteId);
    }
  };

  const handleDeleteListItem = (noteId: string, itemIndex: number) => {
    const note = notes.find(n => n.id === noteId);
    if (note && note.listItems) {
      // Save state for undo before deleting item
      pushUndo({ type: 'deleteItem', noteId, previousState: { ...note, listItems: [...note.listItems] }, itemIndex });
      const updatedItems = note.listItems.filter((_, i) => i !== itemIndex);
      updateNote(noteId, { listItems: updatedItems });
    }
  };

  const handleToggleSelection = (noteId: string, event?: any) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const note = notes.find(n => n.id === noteId);
    if (note) {
      updateNote(noteId, { isSelected: !note.isSelected });
    }
  };

  const handleNotePress = (noteId: string) => {
    if (hasSelectedNotes) {
      handleToggleSelection(noteId);
    }
  };

  const handleTogglePrivateSelected = () => {
    const selectedNotes = notes.filter(n => n.isSelected);
    if (selectedNotes.length === 0) {
      Alert.alert(t('noNoteSelected'), t('selectAtLeastOne'));
      return;
    }
    
    if (!settings.privateNotesPin) {
      setPinAction('set');
      setShowPinModal(true);
    } else {
      setPinAction('verify');
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = () => {
    if (pinAction === 'set') {
      if (pinInput.length < 4) {
        Alert.alert(t('pinTooShort'), t('pinMustBe4Digits'));
        return;
      }
      updateSettings({ privateNotesPin: pinInput });
      const selectedNotes = notes.filter(n => n.isSelected);
      const allPrivate = selectedNotes.every(n => n.isPrivate);
      selectedNotes.forEach(note => {
        updateNote(note.id, { isPrivate: !allPrivate, isSelected: false });
      });

      setPinInput('');
      setShowPinModal(false);
      Alert.alert(t('pinConfigured'), t('pinConfiguredSuccess'));
    } else if (pinAction === 'verify') {
      if (pinInput === settings.privateNotesPin) {
        const selectedNotes = notes.filter(n => n.isSelected);
        const allPrivate = selectedNotes.every(n => n.isPrivate);
        selectedNotes.forEach(note => {
          updateNote(note.id, { isPrivate: !allPrivate, isSelected: false });
        });
  
        setPinInput('');
        setShowPinModal(false);
      } else {
        Alert.alert(t('incorrectPIN'), t('incorrectPINMessage'));
        setPinInput('');
      }
    } else if (pinAction === 'view') {
      if (pinInput === settings.privateNotesPin) {
        setIsPrivateNotesUnlocked(true);
        setPinInput('');
        setShowPinModal(false);
      } else {
        Alert.alert(t('incorrectPIN'), t('incorrectPINMessage'));
        setPinInput('');
      }
    }
  };

  const handleViewPrivateNotes = () => {
    if (!settings.privateNotesPin) {
      Alert.alert(t('noPinConfigured'), t('markNotesPrivateFirst'));
      return;
    }
    setPinAction('view');
    setShowPinModal(true);
  };

  const handleCancelSelection = () => {
    notes.forEach(note => {
      if (note.isSelected) {
        updateNote(note.id, { isSelected: false });
      }
    });
  };

  const handleCopySelected = async () => {
    const selectedNotes = notes.filter(n => n.isSelected);
    if (selectedNotes.length === 0) return;

    let textToCopy = '';
    selectedNotes.forEach((note, index) => {
      if (index > 0) textToCopy += '\n\n---\n\n';
      textToCopy += note.content;
      if (note.type === 'list' && note.listItems) {
        textToCopy += '\n' + note.listItems.map((item, i) => `${i + 1}. ${item.completed ? '[✓]' : '[ ]'} ${item.text}`).join('\n');
      }
    });

    try {
      await Share.share({ message: textToCopy });
    } catch (error) {
      console.error('Error copying notes:', error);
    }
  };

  const handleShareSelected = async () => {
    const selectedNotes = notes.filter(n => n.isSelected);
    if (selectedNotes.length === 0) return;

    let textToShare = '';
    selectedNotes.forEach((note, index) => {
      if (index > 0) textToShare += '\n\n---\n\n';
      textToShare += note.content;
      if (note.type === 'list' && note.listItems) {
        textToShare += '\n' + note.listItems.map((item, i) => `${i + 1}. ${item.completed ? '[✓]' : '[ ]'} ${item.text}`).join('\n');
      }
    });

    try {
      await Share.share({ message: textToShare });
    } catch (error) {
      console.error('Error sharing notes:', error);
    }
  };

  const handleTranslateSelected = async () => {
    const selectedNotes = notes.filter(n => n.isSelected);
    if (selectedNotes.length === 0) return;

    Alert.alert(t('translate'), t('translateFeatureComingSoon'));
  };

  const handleDeleteSelected = () => {
    const selectedNotes = notes.filter(n => n.isSelected);
    if (selectedNotes.length === 0) return;

    Alert.alert(
      t('deleteNotes'),
      `${t('deleteNotesConfirm')} ${selectedNotes.length} ${selectedNotes.length === 1 ? t('notes_one') : t('notes_other')}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('delete'), 
          style: 'destructive', 
          onPress: () => {
            selectedNotes.forEach(note => {
              if (speakingNoteId === note.id) {
                Speech.stop();
                setSpeakingNoteId(null);
                setIsSpeaking(false);
              }
              // Save state for undo before deleting
              pushUndo({ type: 'delete', noteId: note.id, previousState: { ...note } });
              deleteNote(note.id);
              // Clean up tracking data for deleted note
              clearNoteTracking(note.id);
            });
      
          }
        },
      ],
      { cancelable: true }
    );
  };

  const handleToggleImportantSelected = () => {
    const selectedNotes = notes.filter(n => n.isSelected);
    if (selectedNotes.length === 0) return;

    const allImportant = selectedNotes.every(n => n.isImportant);
    selectedNotes.forEach(note => {
      updateNote(note.id, { isImportant: !allImportant, isSelected: false });
    });
  };

  const handleTogglePrivateNotesVisibility = () => {
    if (isPrivateNotesUnlocked) {
      setIsPrivateNotesUnlocked(false);
      setShowOptionsMenu(false);
    } else {
      if (!settings.privateNotesPin) {
        Alert.alert(t('noPinConfigured'), t('markNotesPrivateFirst'));
        return;
      }
      setPinAction('view');
      setShowPinModal(true);
      setShowOptionsMenu(false);
    }
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates.height;
        setScrollContentPaddingBottom(height + 80);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setScrollContentPaddingBottom(140);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const hasSelectedNotes = notes.some(n => n.isSelected);

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isImportant && !b.isImportant) return -1;
    if (!a.isImportant && b.isImportant) return 1;
    return b.createdAt - a.createdAt;
  });

  const startsWithQuery = (text: string, query: string): boolean => {
    const textWords = text.toLowerCase().split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return queryWords.every(qWord => 
      textWords.some(tWord => tWord.startsWith(qWord))
    );
  };

  const filteredNotes = useMemo(() => {
    console.log('=== Filtering notes ===', { notesSearchFilter, totalNotes: sortedNotes.length });
    
    let filtered = sortedNotes;
    
    if (notesSearchFilter && notesSearchFilter.trim()) {
      const query = notesSearchFilter.toLowerCase().trim();
      console.log('Applying search filter:', query);
      
      filtered = sortedNotes.filter(note => {
        if (note.isPrivate) return false;
        
        if (startsWithQuery(note.content, query)) return true;
        if (note.type === 'list' && note.listItems) {
          return note.listItems.some(item => startsWithQuery(item.text, query));
        }
        return false;
      });
      
      console.log('Filtered notes count:', filtered.length);
    } else {
      filtered = sortedNotes.filter(note => {
        if (note.isPrivate && !isPrivateNotesUnlocked) return false;
        return true;
      });
      console.log('No filter applied, showing all non-private notes:', filtered.length);
    }
    
    return filtered;
  }, [sortedNotes, notesSearchFilter, isPrivateNotesUnlocked]);

  const shouldHighlight = (text: string, query: string): boolean => {
    if (!query || !text) return false;
    return startsWithQuery(text, query);
  };

  const groupedNotes = useMemo(() => {
    return filteredNotes.reduce((groups, note) => {
      const noteDate = new Date(note.createdAt);
      const dateKey = noteDate.toLocaleDateString(settings.appLanguage || 'ca-ES', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(note);
      return groups;
    }, {} as Record<string, Note[]>);
  }, [filteredNotes, settings.appLanguage]);

  const getBackgroundColor = () => {
    if (settings.screenBackgroundColor) {
      return settings.screenBackgroundColor;
    }
    return isDarkMode ? Colors.dark.background : '#f5f5f5';
  };

  const getStatusBarStyle = () => {
    const bgColor = getBackgroundColor();
    if (bgColor === '#000000' || bgColor === Colors.dark.background) {
      return 'light-content';
    }
    return isDarkMode ? 'light-content' : 'dark-content';
  };

  const backgroundColor = getBackgroundColor();

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      console.log('Double tap detected - toggling voice button');
      updateSettings({ voiceButtonEnabled: !settings.voiceButtonEnabled });
    }
    setLastTap(now);
  };

  return (
    <Pressable
      style={[styles.outerContainer, { backgroundColor }]}
      onPress={handleDoubleTap}
    >
      <StatusBar
        barStyle={getStatusBarStyle()}
        backgroundColor="transparent"
        translucent
      />
      <KeyboardAvoidingView 
        style={[
          styles.container, 
          { backgroundColor }
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.statusBarSpacer, { height: insets.top, backgroundColor }]} />
        <ScrollView 
          ref={scrollViewRef}
          style={styles.notesContainer}
          contentContainerStyle={[styles.notesContent, { paddingBottom: scrollContentPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          scrollEnabled={true}
          nestedScrollEnabled={true}
        >
        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>{t('noNotesYet')}</Text>
            <Text style={[styles.emptySubtext, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>{t('pressToAdd')}</Text>
          </View>
        ) : (
          Object.entries(groupedNotes).map(([dateKey, dayNotes]) => {
            if (dayNotes.length === 0) return null;
            
            const firstNote = dayNotes[0];
            const noteDate = new Date(firstNote.createdAt);
            const dayOfWeek = noteDate.toLocaleDateString(settings.appLanguage || 'ca-ES', { weekday: 'long' });
            const formattedDate = noteDate.toLocaleDateString(settings.appLanguage || 'ca-ES', {
              day: 'numeric',
              month: 'short',
            });
            
            return (
            <View key={dateKey}>
              <View style={styles.noteDateContainer}>
                <Text style={[styles.noteDateDayOfWeek, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>
                  {dayOfWeek.toUpperCase()}
                </Text>
                <Text style={[styles.noteDateDetails, { color: isDarkMode ? Colors.dark.textSecondary : '#666' }]}>
                  {`, ${formattedDate}`}
                </Text>
              </View>
              {dayNotes.map((note) => {
                return (
              <View key={note.id} style={styles.noteWrapper}>
              <TouchableOpacity 
              style={[
                styles.noteCard,
                note.type === 'list' ? styles.noteCardList : styles.noteCardNote,
                note.isSelected && styles.noteCardSelected,
                note.backgroundColor && { backgroundColor: note.backgroundColor }
              ]}
              onPress={() => handleNotePress(note.id)}
              activeOpacity={hasSelectedNotes ? 0.7 : 1}
              disabled={!hasSelectedNotes}
            >
              <TouchableOpacity 
                style={styles.selectionCheckbox}
                onPress={(e) => handleToggleSelection(note.id, e)}
                activeOpacity={0.7}
              >
                {note.isSelected ? (
                  <View style={styles.checkboxChecked}>
                    <Check size={14} color={Colors.dark.text} />
                  </View>
                ) : (
                  <View style={styles.checkboxUnchecked} />
                )}
              </TouchableOpacity>
              {note.isImportant && (
                <View style={styles.importantBadge}>
                  <Flag size={14} color="#FF3B30" fill="#FF3B30" />
                </View>
              )}
              {note.type === 'note' ? (
                <>
                  <View style={styles.noteContentWrapper}>
                    <TextInput
                      style={[
                        styles.directEditInput,
                        { color: (note.backgroundColor === '#000000' || note.backgroundColor === '#1a1a1a' || note.backgroundColor === '#8B8B8D') ? '#ffffff' : '#1a1a1a' },
                        notesSearchFilter && shouldHighlight(note.content, notesSearchFilter.toLowerCase().trim()) && styles.highlightedInput
                      ]}
                      value={note.content}
                      onChangeText={(text) => handleUpdateNoteContent(note.id, text)}
                      onBlur={() => {
                        handleBlurNoteContent(note.id, note.content);
                        setIsEditingNote(false);
                        setActiveNoteInput(null);
                      }}
                      onFocus={() => handleFocusNote(note.id)}
                      placeholder={t('writeYourNote')}
                      placeholderTextColor={(note.backgroundColor === '#000000' || note.backgroundColor === '#1a1a1a' || note.backgroundColor === '#8B8B8D') ? '#999999' : Colors.dark.textSecondary}
                      multiline
                      autoFocus={!note.content}
                      editable={!hasSelectedNotes}
                    />
                  </View>
                  <View style={styles.noteActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleShareNote(note)}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Share2 size={16} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.actionButton, 
                        speakingNoteId === note.id && styles.actionButtonActive
                      ]}
                      onPress={() => handleSpeakNote(note)}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Volume2 
                        size={16} 
                        color={speakingNoteId === note.id ? Colors.dark.success : '#ffffff'} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButtonDelete}
                      onPress={() => handleDeleteNote(note.id, note.content)}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Trash2 size={16} color="#ff3b30" />
                    </TouchableOpacity>
                    <View style={styles.spacer} />
                    {note.isPrivate && (
                      <View style={styles.privateFooterBadge}>
                        <Lock size={12} color={Colors.dark.warning} />
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.noteContentWrapper}>
                    <TextInput
                      style={[
                        styles.directEditTitle,
                        { color: (note.backgroundColor === '#000000' || note.backgroundColor === '#1a1a1a' || note.backgroundColor === '#8B8B8D') ? '#ffffff' : '#1a1a1a' },
                        notesSearchFilter && shouldHighlight(note.content, notesSearchFilter.toLowerCase().trim()) && styles.highlightedInput
                      ]}
                      value={note.content}
                      onChangeText={(text) => {
                        if (text.includes('\n')) {
                          const lines = text.split('\n');
                          handleUpdateListTitle(note.id, lines[0]);
                          if (lines[1] !== undefined) {
                            handleAddListItem(note.id);
                          }
                        } else {
                          handleUpdateListTitle(note.id, text);
                        }
                      }}
                      onFocus={() => handleFocusNote(note.id)}
                      onBlur={() => {
                        setIsEditingNote(false);
                        setActiveNoteInput(null);
                      }}
                      placeholder={t('listTitle')}
                      placeholderTextColor={(note.backgroundColor === '#000000' || note.backgroundColor === '#1a1a1a' || note.backgroundColor === '#8B8B8D') ? '#999999' : Colors.dark.textSecondary}
                      autoFocus={!note.content}
                      returnKeyType="next"
                      multiline
                      onSubmitEditing={() => {
                        if (!note.listItems || note.listItems.length === 0) {
                          handleAddListItem(note.id);
                        }
                      }}
                      editable={!hasSelectedNotes}
                    />
                  </View>
                  {note.listItems && note.listItems.length > 0 && (
                    <View style={styles.listItemsContainer}>
                      {note.listItems.map((item, index) => (
                        <View key={index} style={styles.listItemRow}>
                          <TouchableOpacity 
                            style={styles.checkboxContainer}
                            onPress={() => handleToggleListItem(note.id, index)}
                            activeOpacity={0.7}
                            disabled={hasSelectedNotes}
                          >
                            {item.completed ? (
                              <View style={styles.checkboxChecked}>
                                <Check size={14} color={Colors.dark.text} />
                              </View>
                            ) : (
                              <View style={styles.checkboxUnchecked} />
                            )}
                          </TouchableOpacity>
                          <TextInput
                            ref={(ref) => { newItemInputRefs.current[`${note.id}-${index}`] = ref; }}
                            style={[
                              styles.listItemInput,
                              item.completed && styles.listItemInputCompleted,
                              { color: (note.backgroundColor === '#000000' || note.backgroundColor === '#1a1a1a' || note.backgroundColor === '#8B8B8D') ? '#ffffff' : '#1a1a1a' },
                              notesSearchFilter && startsWithQuery(item.text, notesSearchFilter.toLowerCase().trim()) && styles.highlightedInput
                            ]}
                            value={item.text}
                            onChangeText={(text) => {
                              if (text.includes('\n')) {
                                const cleanText = text.replace(/\n/g, '');
                                handleUpdateListItem(note.id, index, cleanText);
                                handleListItemKeyPress(note.id, index, cleanText);
                              } else {
                                handleUpdateListItem(note.id, index, text);
                              }
                            }}
                            onFocus={() => handleFocusNote(note.id, index)}
                            onBlur={() => {
                              setIsEditingNote(false);
                              setActiveNoteInput(null);
                            }}
                            placeholder={`${t('element')} ${index + 1}...`}
                            placeholderTextColor={(note.backgroundColor === '#000000' || note.backgroundColor === '#1a1a1a' || note.backgroundColor === '#8B8B8D') ? '#999999' : Colors.dark.textSecondary}
                            autoFocus={!item.text}
                            multiline
                            editable={!hasSelectedNotes}
                          />
                          <TouchableOpacity 
                            style={styles.listItemDeleteButton}
                            onPress={() => handleDeleteListItem(note.id, index)}
                            activeOpacity={0.7}
                            disabled={hasSelectedNotes}
                          >
                            <Trash2 size={14} color={Colors.dark.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.noteActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleShareNote(note)}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Share2 size={16} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.actionButton, 
                        speakingNoteId === note.id && styles.actionButtonActive
                      ]}
                      onPress={() => handleSpeakNote(note)}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Volume2 
                        size={16} 
                        color={speakingNoteId === note.id ? Colors.dark.success : '#ffffff'} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButtonDelete}
                      onPress={() => handleDeleteNote(note.id, note.content)}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Trash2 size={16} color="#ff3b30" />
                    </TouchableOpacity>
                    <View style={styles.spacer} />
                    <TouchableOpacity 
                      style={styles.centeredAddButton}
                      onPress={() => {
                        handleAddListItem(note.id, false);
                      }}
                      activeOpacity={0.7}
                      disabled={hasSelectedNotes}
                    >
                      <Plus size={18} color="#5B9BD5" strokeWidth={3} />
                    </TouchableOpacity>
                    <View style={styles.spacer} />
                    {note.isPrivate && (
                      <View style={styles.privateFooterBadge}>
                        <Lock size={12} color={Colors.dark.warning} />
                      </View>
                    )}
                  </View>
                </>
              )}
            </TouchableOpacity>
            </View>
                );
              })}
            </View>
            );
          })
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View 
        style={[styles.footer, { 
          backgroundColor: isDarkMode ? Colors.dark.surface : '#ffffff', 
          borderTopColor: isDarkMode ? Colors.dark.border : '#e0e0e0',
          paddingBottom: Math.max(insets.bottom + 2.5, 8),
        }]}
        pointerEvents="box-none"
      >
        {hasSelectedNotes ? (
          <>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={handleCancelSelection}
              activeOpacity={0.7}
            >
              <Text style={styles.footerButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.footerIconButton}
              onPress={handleTogglePrivateSelected}
              activeOpacity={0.7}
            >
              <Lock size={22} color={Colors.dark.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => setShowOptionsMenu(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.footerButtonText}>{t('options')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {canUndo && currentPage === 0 && (
              <TouchableOpacity 
                style={styles.footerUndoButton}
                onPress={handleUndo}
                activeOpacity={0.7}
              >
                <Undo2 size={22} color={Colors.dark.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.footerWideButton}
              onPressIn={handleCreateNote}
              activeOpacity={0.7}
            >
              <View style={styles.footerWideButtonIcon}>
                <FileText size={28} color="#ffffff" strokeWidth={2.5} />
              </View>
              <Text style={styles.footerWideButtonText}>{t('note')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.footerIconButton}
              onPress={handleTogglePrivateNotesVisibility}
              activeOpacity={0.7}
            >
              <Lock size={22} color={Colors.dark.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.footerWideButton}
              onPressIn={handleCreateList}
              activeOpacity={0.7}
            >
              <View style={styles.footerWideButtonIcon}>
                <List size={28} color="#ffffff" strokeWidth={2.5} />
              </View>
              <Text style={styles.footerWideButtonText}>{t('list')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isSpeaking && (
        <View style={styles.floatingStopButton}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={() => {
              Speech.stop();
              setSpeakingNoteId(null);
              setIsSpeaking(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.stopButtonText}>{t('stop')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPinModal(false);
          setPinInput('');
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.pinModal, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={styles.pinModalHeader}>
              <Text style={[styles.pinModalTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                {pinAction === 'set' ? t('configurePIN') : pinAction === 'verify' ? t('enterPIN') : t('unlockPrivateNotes')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPinModal(false);
                  setPinInput('');
                }}
                activeOpacity={0.7}
              >
                <X size={24} color={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.pinInput, { 
                backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
                color: isDarkMode ? Colors.dark.text : Colors.light.text,
                borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
              }]}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder={t('enterPIN')}
              placeholderTextColor={isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={styles.pinSubmitButton}
              onPress={handlePinSubmit}
              activeOpacity={0.7}
            >
              <Text style={styles.pinSubmitButtonText}>{t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={[styles.optionsMenu, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleCopySelected();
              }}
              activeOpacity={0.7}
            >
              <Copy size={20} color={isDarkMode ? Colors.dark.text : Colors.light.text} />
              <Text style={[styles.optionText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('copy')}</Text>
            </TouchableOpacity>
            <View style={[styles.optionDivider, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleShareSelected();
              }}
              activeOpacity={0.7}
            >
              <Share2 size={20} color={isDarkMode ? Colors.dark.text : Colors.light.text} />
              <Text style={[styles.optionText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('share')}</Text>
            </TouchableOpacity>
            <View style={[styles.optionDivider, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleTranslateSelected();
              }}
              activeOpacity={0.7}
            >
              <Languages size={20} color={isDarkMode ? Colors.dark.text : Colors.light.text} />
              <Text style={[styles.optionText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('translate')}</Text>
            </TouchableOpacity>
            <View style={[styles.optionDivider, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleToggleImportantSelected();
              }}
              activeOpacity={0.7}
            >
              <Flag size={20} color="#FF3B30" />
              <Text style={[styles.optionText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('markAsImportant')}</Text>
            </TouchableOpacity>
            <View style={[styles.optionDivider, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleTogglePrivateSelected();
              }}
              activeOpacity={0.7}
            >
              <Lock size={20} color={Colors.dark.warning} />
              <Text style={[styles.optionText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                {notes.filter(n => n.isSelected).every(n => n.isPrivate) ? t('removeFromPrivate') : t('addToPrivate')}
              </Text>
            </TouchableOpacity>
            <View style={[styles.optionDivider, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleDeleteSelected();
              }}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color={Colors.dark.danger} />
              <Text style={[styles.optionText, { color: Colors.dark.danger }]}>{t('delete')}</Text>
            </TouchableOpacity>
            <View style={[styles.optionDivider, { backgroundColor: isDarkMode ? Colors.dark.border : Colors.light.border }]} />
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleTogglePrivateNotesVisibility}
              activeOpacity={0.7}
            >
              <Lock size={20} color={Colors.dark.warning} />
              <Text style={[styles.optionText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>
                {isPrivateNotesUnlocked ? t('hidePrivateNotes') : t('showPrivateNotes')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showUnsavedChangesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnsavedChangesModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.unsavedChangesModal, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <Text style={[styles.unsavedChangesTitle, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>{t('unsavedChanges')}</Text>
            <Text style={[styles.unsavedChangesMessage, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('unsavedChangesMessage')}</Text>
            <View style={styles.unsavedChangesButtons}>
              <TouchableOpacity
                style={[styles.unsavedChangesButton, styles.unsavedChangesButtonPrimary]}
                onPress={() => {
                  // Save changes means keep the current state (deletions applied)
                  setShowUnsavedChangesModal(false);
                  clearUndoStack();
                  Keyboard.dismiss();
                  setIsEditingNote(false);
                  setActiveNoteInput(null);
                  setNotesSearchFilter('');
                  setIsPrivateNotesUnlocked(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.unsavedChangesButtonTextPrimary}>{t('saveChanges')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unsavedChangesButton, styles.unsavedChangesButtonDanger]}
                onPress={() => {
                  // Discard changes means undo all deletions
                  handleDiscardAllChanges();
                  setShowUnsavedChangesModal(false);
                  Keyboard.dismiss();
                  setIsEditingNote(false);
                  setActiveNoteInput(null);
                  setNotesSearchFilter('');
                  setIsPrivateNotesUnlocked(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.unsavedChangesButtonTextDanger}>{t('discardChanges')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unsavedChangesButton, { 
                  backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface,
                  borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
                }]}
                onPress={() => {
                  setShowUnsavedChangesModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.unsavedChangesButtonTextSecondary, { color: isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>{t('stayOnPage')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  statusBarSpacer: {
    width: '100%',
    zIndex: 9999,
  },
  notesContainer: {
    flex: 1,
  },
  notesContent: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  noteWrapper: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  noteCard: {
    borderRadius: 12,
    padding: 12,
    paddingBottom: 6,
    gap: 8,
    borderWidth: 0,
    borderBottomWidth: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteCardNote: {
    borderBottomColor: '#5B9BD5',
  },
  noteCardList: {
    borderBottomColor: '#FF9500',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  noteContent: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 24,
  },
  listBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemsContainer: {
    marginTop: 8,
    gap: -6,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 0,
  },
  listItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  listItemDeleteButton: {
    paddingTop: 6,
  },
  checkboxContainer: {
    marginTop: 2,
  },
  checkboxUnchecked: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#5B9BD5',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#5B9BD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: Colors.dark.text,
    lineHeight: 22,
  },
  listItemTextCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  noteDateContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
    marginLeft: 4,
  },
  noteDateDayOfWeek: {
    fontSize: 20,
    fontWeight: '700' as const,
    opacity: 0.95,
  },
  noteDateDetails: {
    fontSize: 16,
    fontWeight: '600' as const,
    opacity: 0.90,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 6,
    paddingBottom: 3,
    borderTopWidth: 0,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    marginBottom: -6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(91, 155, 213, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(91, 155, 213, 0.6)',
  },
  actionButtonDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  actionButtonActive: {
    backgroundColor: Colors.dark.primary + '20',
  },
  spacer: {
    flex: 1,
  },
  directEditInput: {
    padding: 0,
    paddingRight: 32,
    color: '#1a1a1a',
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  directEditTitle: {
    padding: 0,
    paddingRight: 32,
    color: '#1a1a1a',
    fontSize: 17,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  listItemInput: {
    flex: 1,
    padding: 0,
    color: '#666666',
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  listItemInputCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  fixedAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.primary + '40',
  },
  centeredAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.primary + '60',
  },
  privateFooterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.warning + '30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.warning + '60',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 20,
  },
  pinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  pinInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    borderWidth: 1,
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinSubmitButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pinSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  selectionCheckbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  importantBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
  noteCardSelected: {
    opacity: 1,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonTextDisabled: {
    color: Colors.dark.textSecondary,
  },
  optionsMenu: {
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 24,
    marginTop: 'auto' as const,
    marginBottom: 'auto' as const,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  optionDivider: {
    height: 1,
    marginHorizontal: 8,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  footerWideButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0051A8',
    borderWidth: 0,
    shadowColor: '#0051A8',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  footerWideButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  footerWideButtonIcon: {
    shadowColor: '#ffffff',
    shadowOffset: { width: 1, height: -1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  footerIconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.primary + '60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.primary + '60',
  },
  footerButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  floatingStopButton: {
    position: 'absolute',
    bottom: 120,
    right: 24,
    zIndex: 9999,
    elevation: 9999,
  },
  stopButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  noteContentWrapper: {
    position: 'relative',
  },
  highlightedInput: {
    backgroundColor: 'rgba(255, 255, 0, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  footerUndoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.primary + '60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsavedChangesModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  unsavedChangesTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  unsavedChangesMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  unsavedChangesButtons: {
    gap: 10,
    marginTop: 8,
  },
  unsavedChangesButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  unsavedChangesButtonPrimary: {
    backgroundColor: Colors.dark.primary,
  },
  unsavedChangesButtonDanger: {
    backgroundColor: Colors.dark.danger + '20',
    borderWidth: 1,
    borderColor: Colors.dark.danger + '60',
  },
  unsavedChangesButtonSecondary: {
    borderWidth: 1,
  },
  unsavedChangesButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  unsavedChangesButtonTextDanger: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.danger,
  },
  unsavedChangesButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
