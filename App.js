import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import VolumeKnob from './VolumeKnob';
import {
  DEFAULT_IP,
  ERROR_MESSAGE,
  INPUTS,
  formatVolume,
  formatInput,
  getStatus,
  nudgeVolume,
  setInput,
  setMute,
  setPower,
} from './yamaha';

const IP_KEY = 'yamaha-rn500-ip';

export default function App() {
  const [ipDraft, setIpDraft] = useState(DEFAULT_IP);
  const [ip, setIp] = useState(DEFAULT_IP);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const ipRef = useRef(ip);
  const volumeQueueRef = useRef(0);
  const volumeSendingRef = useRef(false);

  ipRef.current = ip;

  const run = useCallback(
    async (action) => {
      setBusy(true);
      setError('');
      try {
        const nextStatus = await action(ip);
        setStatus(nextStatus);
      } catch {
        setError(ERROR_MESSAGE);
      } finally {
        setBusy(false);
      }
    },
    [ip]
  );

  const refresh = useCallback(() => run((currentIp) => getStatus(currentIp)), [run]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await AsyncStorage.getItem(IP_KEY);
      const nextIp = (saved || DEFAULT_IP).trim() || DEFAULT_IP;
      if (!cancelled) {
        setIpDraft(nextIp);
        setIp(nextIp);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) {
      refresh();
    }
  }, [ready, refresh]);

  async function saveIp() {
    Keyboard.dismiss();
    const nextIp = ipDraft.trim();
    if (!nextIp) {
      return;
    }
    await AsyncStorage.setItem(IP_KEY, nextIp);
    if (nextIp === ip) {
      refresh();
    } else {
      setIp(nextIp);
    }
  }

  const muteIsOn = status?.mute === 'On';

  const flushVolumeQueue = useCallback(async () => {
    if (volumeSendingRef.current) {
      return;
    }
    volumeSendingRef.current = true;
    try {
      while (volumeQueueRef.current !== 0) {
        const direction = volumeQueueRef.current > 0 ? 'Up' : 'Down';
        volumeQueueRef.current += direction === 'Up' ? -1 : 1;
        try {
          await nudgeVolume(ipRef.current, direction);
          setError('');
        } catch {
          setError(ERROR_MESSAGE);
          volumeQueueRef.current = 0;
          break;
        }
      }
    } finally {
      volumeSendingRef.current = false;
      if (volumeQueueRef.current !== 0) {
        flushVolumeQueue();
      }
    }
  }, []);

  const handleVolumeNudge = useCallback(
    (direction) => {
      volumeQueueRef.current = Math.max(
        -16,
        Math.min(16, volumeQueueRef.current + (direction === 'Up' ? 1 : -1))
      );
      setStatus((current) => {
        if (!current || current.volumeDb == null) {
          return current;
        }
        return {
          ...current,
          volumeDb: current.volumeDb + (direction === 'Up' ? 0.5 : -0.5),
        };
      });
      flushVolumeQueue();
    },
    [flushVolumeQueue]
  );

  const handleVolumeGestureEnd = useCallback(async () => {
    setScrollEnabled(true);
    const started = Date.now();
    while (
      (volumeSendingRef.current || volumeQueueRef.current !== 0) &&
      Date.now() - started < 8000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    try {
      const nextStatus = await getStatus(ipRef.current);
      setStatus(nextStatus);
      setError('');
    } catch {
      setError(ERROR_MESSAGE);
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <Text style={styles.title}>Yamaha500 controller</Text>
        <Text style={styles.subtitle}>R-N500 on your local network</Text>

        <Text style={styles.label}>Receiver IP</Text>
        <View style={styles.ipRow}>
          <TextInput
            value={ipDraft}
            onChangeText={setIpDraft}
            placeholder={DEFAULT_IP}
            placeholderTextColor="#6f7785"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={styles.ipInput}
          />
          <Pressable
            onPress={saveIp}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Status</Text>
            {busy ? <ActivityIndicator color="#8be9c5" /> : null}
          </View>
          <StatusLine label="Power" value={status?.power} />
          <StatusLine label="Volume" value={formatVolume(status?.volumeDb)} />
          <StatusLine label="Mute" value={status?.mute} />
          <StatusLine label="Input" value={formatInput(status?.input)} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={refresh}
          disabled={busy}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>

        <View style={styles.row}>
          <BigButton
            label="On"
            color="#1f8a5b"
            disabled={busy}
            onPress={() => run((currentIp) => setPower(currentIp, 'On'))}
          />
          <BigButton
            label="Standby"
            color="#4a5160"
            disabled={busy}
            onPress={() => run((currentIp) => setPower(currentIp, 'Standby'))}
          />
        </View>

        <VolumeKnob
          volumeDb={status?.volumeDb}
          onNudge={handleVolumeNudge}
          onGestureStart={() => setScrollEnabled(false)}
          onGestureEnd={handleVolumeGestureEnd}
        />

        <BigButton
          label={muteIsOn ? 'Mute Off' : 'Mute On'}
          color={muteIsOn ? '#8a3a3a' : '#2a3344'}
          disabled={busy}
          onPress={() =>
            run((currentIp) => setMute(currentIp, muteIsOn ? 'Off' : 'On'))
          }
        />

        <Text style={styles.sectionTitle}>Input</Text>
        <View style={styles.inputGrid}>
          {INPUTS.map((input) => {
            const selected = status?.input === input.value;
            return (
              <Pressable
                key={input.value}
                disabled={busy}
                onPress={() => run((currentIp) => setInput(currentIp, input.value))}
                style={({ pressed }) => [
                  styles.inputButton,
                  selected && styles.inputSelected,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Text
                  style={[styles.inputText, selected && styles.inputTextSelected]}
                  numberOfLines={2}
                >
                  {input.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusLine({ label, value }) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value || '—'}</Text>
    </View>
  );
}

function BigButton({ label, color, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.bigButton,
        { backgroundColor: color },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.bigButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#10141c',
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 18,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    color: '#f4f7fb',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa3b2',
    fontSize: 16,
    marginBottom: 8,
  },
  label: {
    color: '#c5ccd8',
    fontSize: 15,
    fontWeight: '600',
  },
  ipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ipInput: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#1b2230',
    color: '#f4f7fb',
    paddingHorizontal: 16,
    fontSize: 18,
  },
  saveButton: {
    minWidth: 88,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#3d7aed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: '#1b2230',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#f4f7fb',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLabel: {
    color: '#9aa3b2',
    fontSize: 17,
  },
  statusValue: {
    color: '#f4f7fb',
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  error: {
    color: '#ffb4b4',
    backgroundColor: '#3a1f24',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  refreshButton: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3d7aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: '#8bb4ff',
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  bigButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  bigButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputButton: {
    width: '31%',
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#1b2230',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  inputSelected: {
    backgroundColor: '#2d5aa8',
  },
  inputText: {
    color: '#d7deea',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputTextSelected: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
});
