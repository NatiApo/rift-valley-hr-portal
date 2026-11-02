import { useEffect, useRef, useState } from "react";
import { Send, X, MessageSquare, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
};

type Props = {
  requestId: string;
  requestTitle: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  onClose: () => void;
};

export default function RequestChatModal({
  requestId,
  requestTitle,
  currentUserId,
  currentUserName,
  currentUserRole,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<string>("Connecting presence…");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke("department-manage", {
      body: { action: "get_chat_messages", request_id: requestId },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!error && data?.messages) {
      setMessages(data.messages);
    }
  }

  useEffect(() => {
    loadMessages();

    // 1. Real-time message subscription
    const chatChannel = supabase
      .channel(`request_chat_${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "department_request_messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    // 2. Real-time online presence indicator
    const presenceChannel = supabase.channel(`presence_${requestId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          user: currentUserName,
          role: currentUserRole,
          online_at: new Date().toISOString(),
        });
      }
    });

    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const activeUsers = Object.keys(state);
      setOnlineStatus(`${activeUsers.length} participant(s) online in channel`);
    });

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [requestId, currentUserId, currentUserName, currentUserRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;

    const content = text.trim();
    setText("");
    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("department-manage", {
        body: {
          action: "send_chat_message",
          request_id: requestId,
          message: content,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to send");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not send message.");
      setText(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "640px",
          width: "95vw",
          height: "82vh",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e5e9ed", paddingBottom: "14px" }}>
          <div>
            <div className="eyebrow green" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MessageSquare size={15} /> Request Discussion & Negotiation
            </div>
            <h2 style={{ fontSize: "20px", margin: "4px 0 2px" }}>{requestTitle}</h2>
            <small style={{ color: "#226341", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {onlineStatus}
            </small>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {messages.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: "#71808a", fontSize: "13px" }}>
              <p>No discussion history for this request yet.</p>
              <p>Chat with HR or Department managers below regarding corrections, candidate requirements, or approval updates.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === currentUserId;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    background: isMe ? "#173d35" : "#f0f4f2",
                    color: isMe ? "#fff" : "#17212b",
                    padding: "11px 15px",
                    borderRadius: "12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontSize: "10px", opacity: 0.8, marginBottom: "4px", display: "flex", justifyContent: "space-between", gap: "16px" }}>
                    <span>
                      <b>{m.sender_name}</b> ({m.sender_role})
                    </span>
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div style={{ fontSize: "13px", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.5" }}>
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} style={{ display: "flex", gap: "10px", borderTop: "1px solid #e5e9ed", paddingTop: "14px" }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message regarding this vacancy request..."
            style={{ flex: 1, padding: "12px 14px", borderRadius: "8px", border: "1px solid #dce2e7", outline: "none", fontSize: "13px" }}
          />
          <button type="submit" className="department-primary" disabled={busy || !text.trim()}>
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}