export async function runAutoTitle(
  conversationId: string,
  firstUserMsg: string,
  firstReply: string,
  dispatch: any
) {
  let targetTitle = "New conversation";
  try {
    const res = await fetch("/api/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstUserMsg, firstReply }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.title) {
        targetTitle = data.title;
      }
    }
  } catch (err) {
    console.error("Auto-title error:", err);
    const trimmed = firstUserMsg.trim();
    targetTitle = trimmed.length <= 36 ? trimmed : trimmed.slice(0, 36) + "...";
  }

  dispatch({
    type: "SET_TYPING_TITLE",
    conversationId,
    title: "",
    isTypingTitle: true,
  });

  for (let i = 1; i <= targetTitle.length; i++) {
    await new Promise((r) => setTimeout(r, 22));
    const partial = targetTitle.slice(0, i);
    dispatch({
      type: "SET_TYPING_TITLE",
      conversationId,
      title: partial,
      isTypingTitle: true,
    });
  }

  dispatch({
    type: "SET_TYPING_TITLE",
    conversationId,
    title: targetTitle,
    isTypingTitle: false,
  });
}
