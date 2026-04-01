import { useRef, useState, useCallback, useEffect } from 'react';
import { audioEngine } from '@/lib/equalizer';

interface AudioVisualizerData {
  frequencyData: Uint8Array;
  averageFrequency: number;
  bassFrequency: number;
  midFrequency: number;
  highFrequency: number;
}

const defaultData: AudioVisualizerData = {
  frequencyData: new Uint8Array(0),
  averageFrequency: 0,
  bassFrequency: 0,
  midFrequency: 0,
  highFrequency: 0,
};

const THROTTLE_MS = 100;

export const useAudioVisualizer = (audioElement: HTMLAudioElement | null, isPlaying: boolean) => {
  const [visualizerData, setVisualizerData] = useState<AudioVisualizerData>(defaultData);
  const intervalRef = useRef<number | null>(null);

  const analyze = useCallback(() => {
    const analyser = audioEngine.getAnalyser();
    if (!analyser || !isPlaying) {
      setVisualizerData(defaultData);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const bassEnd = Math.floor(bufferLength * 0.15);
    const midEnd = Math.floor(bufferLength * 0.5);

    let bassSum = 0, midSum = 0, highSum = 0;
    for (let i = 0; i < bufferLength; i++) {
      if (i < bassEnd) bassSum += dataArray[i];
      else if (i < midEnd) midSum += dataArray[i];
      else highSum += dataArray[i];
    }

    setVisualizerData({
      frequencyData: dataArray,
      averageFrequency: (bassSum + midSum + highSum) / bufferLength / 255,
      bassFrequency: bassSum / bassEnd / 255,
      midFrequency: midSum / (midEnd - bassEnd) / 255,
      highFrequency: highSum / (bufferLength - midEnd) / 255,
    });
  }, [isPlaying]);

  useEffect(() => {
    if (audioElement && isPlaying) {
      // The audioEngine.bind() is called by the EQ modal or PlayerContext,
      // we just read from the shared analyser
      intervalRef.current = window.setInterval(analyze, THROTTLE_MS);
    } else {
      setVisualizerData(defaultData);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [audioElement, isPlaying, analyze]);

  return visualizerData;
};
