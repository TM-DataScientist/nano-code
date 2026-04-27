// OpenAIのChat Completions APIを呼び出す最小限の実装
// このファイルは「OpenAIに質問を送り、返ってきた回答を表示する」サンプルです。

// async function は「中で await を使える関数」です。
// await を使うと、通信などの時間がかかる処理が終わるまで待ってから次の行へ進めます。
async function callOpenAI() {
  // fetch は、指定したURLにHTTPリクエストを送るための関数です。
  // ここでは OpenAI の Chat Completions API に POST リクエストを送っています。
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    // method: 'POST' は「データを送信するリクエスト」であることを表します。
    method: 'POST',

    // headers は、リクエストに付ける追加情報です。
    headers: {
      // Authorization ヘッダーにはAPIキーを入れます。
      // `Bearer ${process.env.OPENAI_API_KEY}` はテンプレートリテラルです。
      // process.env.OPENAI_API_KEY には、環境変数 OPENAI_API_KEY の値が入ります。
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,

      // Content-Type: application/json は、送るデータがJSON形式であることを表します。
      'Content-Type': 'application/json',
    },

    // body には、OpenAI API に送る実際のデータを書きます。
    // JavaScript のオブジェクトをそのまま送ることはできないため、
    // JSON.stringify でJSON文字列に変換しています。
    body: JSON.stringify({
      // model は、どのAIモデルを使うかを指定します。
      model: 'gpt-5-mini',

      // messages は、会話の内容を配列で渡します。
      // role: 'user' は「ユーザーからの発言」という意味です。
      // content が、実際にAIへ送る質問文です。
      messages: [
        { role: 'user', content: 'TypeScriptについて簡潔に説明してください。' }
      ],
    }),
  });

  // response.json() は、APIから返ってきたJSON形式のレスポンスを
  // JavaScript のオブジェクトとして扱えるように変換します。
  const data = await response.json();

  // OpenAI の回答本文は data.choices[0].message.content に入っています。
  // choices は回答候補の配列で、ここでは最初の回答だけを取り出しています。
  console.log(data.choices[0].message.content);
}

// 関数を実行
callOpenAI();
