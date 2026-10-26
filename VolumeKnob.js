import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { formatVolume } from './yamaha';

const SIZE = 240;
const CENTER = SIZE / 2;
const DEAD_ZONE = 28;
const STEP_RAD = (12 * Math.PI) / 180;

function angleFromEvent(evt) {
  const { locationX, locationY } = evt.nativeEvent;
  return Math.atan2(locationY - CENTER, locationX - CENTER);
}

function wrappedDelta(from, to) {
  let delta = to - from;
  if (delta > Math.PI) {
    delta -= 2 * Math.PI;
  } else if (delta < -Math.PI) {
    delta += 2 * Math.PI;
  }
  return delta;
}

export default function VolumeKnob({ volumeDb, onNudge, onGestureStart, onGestureEnd }) {
  const lastAngleRef = useRef(null);
  const leftoverRef = useRef(0);
  const rotationRef = useRef(0);
  const onNudgeRef = useRef(onNudge);
  const onGestureStartRef = useRef(onGestureStart);
  const onGestureEndRef = useRef(onGestureEnd);
  const [rotationDeg, setRotationDeg] = useState(0);

  onNudgeRef.current = onNudge;
  onGestureStartRef.current = onGestureStart;
  onGestureEndRef.current = onGestureEnd;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastAngleRef.current = angleFromEvent(evt);
        leftoverRef.current = 0;
        onGestureStartRef.current?.();
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const distance = Math.hypot(locationX - CENTER, locationY - CENTER);
        if (distance < DEAD_ZONE) {
          lastAngleRef.current = null;
          return;
        }

        const angle = angleFromEvent(evt);
        if (lastAngleRef.current == null) {
          lastAngleRef.current = angle;
          return;
        }

        const delta = wrappedDelta(lastAngleRef.current, angle);
        lastAngleRef.current = angle;
        leftoverRef.current += delta;
        rotationRef.current += delta;
        setRotationDeg((rotationRef.current * 180) / Math.PI);

        while (leftoverRef.current >= STEP_RAD) {
          leftoverRef.current -= STEP_RAD;
          onNudgeRef.current?.('Up');
        }
        while (leftoverRef.current <= -STEP_RAD) {
          leftoverRef.current += STEP_RAD;
          onNudgeRef.current?.('Down');
        }
      },
      onPanResponderRelease: () => {
        lastAngleRef.current = null;
        leftoverRef.current = 0;
        onGestureEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        lastAngleRef.current = null;
        leftoverRef.current = 0;
        onGestureEndRef.current?.();
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Clockwise louder · anticlockwise quieter</Text>
      <View style={styles.knob} {...panResponder.panHandlers}>
        <View
          pointerEvents="none"
          style={[styles.tickWrap, { transform: [{ rotate: `${rotationDeg}deg` }] }]}
        >
          <View style={styles.tick} />
        </View>
        <View pointerEvents="none" style={styles.center}>
          <Text style={styles.volume}>{formatVolume(volumeDb)}</Text>
          <Text style={styles.caption}>Volume</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  hint: {
    color: '#9aa3b2',
    fontSize: 14,
    textAlign: 'center',
  },
  knob: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#1b2230',
    borderWidth: 6,
    borderColor: '#3d7aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  tick: {
    marginTop: 14,
    width: 14,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#8be9c5',
  },
  center: {
    alignItems: 'center',
    gap: 4,
  },
  volume: {
    color: '#f4f7fb',
    fontSize: 28,
    fontWeight: '700',
  },
  caption: {
    color: '#9aa3b2',
    fontSize: 16,
    fontWeight: '600',
  },
});
