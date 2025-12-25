// Local embeddings using HuggingFace Transformers.js
import { pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let loadingPromise: Promise<any> | null = null;

export type EmbeddingStatus = "idle" | "loading" | "ready" | "error";

let statusListeners: ((status: EmbeddingStatus) => void)[] = [];
let currentStatus: EmbeddingStatus = "idle";

const setStatus = (status: EmbeddingStatus) => {
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
};

export const onStatusChange = (listener: (status: EmbeddingStatus) => void) => {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
};

export const getEmbeddingStatus = () => currentStatus;

export const initEmbeddings = async () => {
  if (extractor) return extractor;
  if (loadingPromise) return loadingPromise;

  setStatus("loading");

  loadingPromise = (async () => {
    try {
      // Use a small, fast model for embeddings - try WebGPU first
      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { device: "webgpu" }
      );
      setStatus("ready");
      return extractor;
    } catch (error) {
      console.warn("WebGPU not available, falling back to CPU:", error);
      try {
        // Fallback to CPU
        extractor = await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2"
        );
        setStatus("ready");
        return extractor;
      } catch (cpuError) {
        console.error("Failed to load embeddings model:", cpuError);
        setStatus("error");
        throw cpuError;
      }
    }
  })();

  return loadingPromise;
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const model = await initEmbeddings();
  
  // Generate embedding
  const output = await model(text, { 
    pooling: "mean", 
    normalize: true 
  });
  
  // Convert to array
  return Array.from(output.data as Float32Array);
};

export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const model = await initEmbeddings();
  
  const results: number[][] = [];
  for (const text of texts) {
    const output = await model(text, { 
      pooling: "mean", 
      normalize: true 
    });
    results.push(Array.from(output.data as Float32Array));
  }
  
  return results;
};
