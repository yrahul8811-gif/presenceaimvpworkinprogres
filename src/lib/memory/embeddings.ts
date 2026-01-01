// Browser-compatible embedding service using HuggingFace Transformers.js
import { pipeline } from "@huggingface/transformers";

export type EmbeddingStatus = "idle" | "loading" | "ready" | "error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let loadingPromise: Promise<any> | null = null;
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
      // Try WebGPU first for better performance
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
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
};

export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const results: number[][] = [];
  for (const text of texts) {
    const emb = await generateEmbedding(text);
    results.push(emb);
  }
  return results;
};

// Get embedding dimension (384 for all-MiniLM-L6-v2)
export const getEmbeddingDimension = async (): Promise<number> => {
  const testEmb = await generateEmbedding("test");
  return testEmb.length;
};
