export interface SSEEvent {
  event?: string;
  data: string;
}

// Server-Sent Events(SSE)のストリームを、event/data の小さなオブジェクトに分解します。
// async generator なので、呼び出し側は `for await (const event of parseSSEStream(stream))` と書けます。
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<SSEEvent> {
  // Web標準の ReadableStream から reader を取得し、Uint8Array のバイト列を順に読みます。
  const reader = stream.getReader();
  // TextDecoder はバイト列を文字列へ変換します。
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // chunk の途中で行が切れることがあるため、未処理の末尾を buffer に残します。
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent: SSEEvent = { data: '' };
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          // SSEでは空行が1イベントの区切りです。
          if (currentEvent.data || currentEvent.event) {
            yield currentEvent;
            currentEvent = { data: '' };
          }
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent.event = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          currentEvent.data = trimmed.slice(5).trim();
        }
      }
    }
  } finally {
    // 正常終了でも例外でも reader のロックを解放します。
    reader.releaseLock();
  }
}


