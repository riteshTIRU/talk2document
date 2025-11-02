
import { useState, useRef, useEffect } from "react";

export default function App() {
  const [messages, setMessages] = useState([]); // { who: "user"|"bot", text }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [file_status, setfile_status ] = useState(false);
  const listRef = useRef(null);
  const placeholderIndexRef = useRef(null);


  
  useEffect(() => {
    
    fetch("/api/csrf/", { credentials: "include" }).catch(() => {});
  }, []);

  
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  
  function getCookie(name) {
    const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? decodeURIComponent(v.pop()) : null;
  }



  const handleFileUpload = async(e) =>{
    const file = e.target.files[0];
    if(!file) return;

    const formData = new FormData();

    formData.append("file",file);

    setBusy(true);

    try {

      const res = await fetch("/api/upload/",
        {
          method: "POST",
          headers: {"X-CSRFToken": getCookie("csrftoken"),},
          body : formData ,
          credentials: "include",
        });

        if(!res.ok){
          throw new Error("Upload Failed");
        }

        const data = await res.json()
        setMessages([{ who: "bot", text: `✅ File "${file.name}" uploaded successfully!` }]);
        setfile_status(true); 

        

    }
    catch (err){
      setMessages([{ who: "bot", text: "❌ Error uploading file." }]);
      console.error(err);
    }
    finally{
      setBusy(false);
    }


  };
  
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy) return;

    
    setMessages((prev) => {
      const next = [...prev, { who: "user", text }, { who: "bot", text: "…" }];
      placeholderIndexRef.current = next.length - 1;
      return next;
    });

    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ message: text }),
        credentials: "include",
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${bodyText}`);
      }

      const data = await res.json();
      const botText = data.response ?? "Error: empty response";

      // replace placeholder with backend response
      setMessages((prev) => {
        const copy = [...prev];
        // find last bot placeholder
        const lastBotIdx = copy.map(m => m.who).lastIndexOf("bot");
        if (lastBotIdx >= 0) {
          copy[lastBotIdx] = { who: "bot", text: botText };
        } else {
          // fallback if no placeholder exists
          copy.push({ who: "bot", text: botText });
        }
        return copy;
      });
    } catch (err) {
      // show error in placeholder
      setMessages((prev) => {
        const copy = [...prev];
        const idx = placeholderIndexRef.current;
        const msg = "Error: " + (err?.message ?? String(err));
        if (idx != null && copy[idx] && copy[idx].who === "bot") {
          copy[idx] = { who: "bot", text: msg };
        } else {
          copy.push({ who: "bot", text: msg });
        }
        return copy;
      });
      console.error("sendMessage error:", err);
    } finally {
      placeholderIndexRef.current = null;
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
    return (
    <div className="page-root">
      <div className="chat-frame" role="main" aria-label="Chat area">
        {!file_status ? (
          <div className="upload-section">
            <h3>Upload a PDF file to start chatting</h3>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          <>
            <div className="messages" ref={listRef}>
              {messages.length === 0 && (
                <div className="hint">
                  Ask me anything about your uploaded PDF — type and press Enter or Send
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`message-row ${m.who === "user" ? "user" : "bot"}`}
                >
                  <div
                    className={`message-bubble ${
                      m.who === "user" ? "bubble-user" : "bubble-bot"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="composer">
              <textarea
                className="composer-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your question..."
                rows={2}
                disabled={busy}
              />
              <button
                className="composer-send"
                onClick={sendMessage}
                disabled={busy}
                aria-disabled={busy}
              >
                {busy ? "Thinking..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
  // return (
  //   <div className="page-root">
  //     <div className="chat-frame" role="main" aria-label="Chat area">
  //       <div className="messages" ref={listRef}>
  //         {messages.length === 0 && (
  //           <div className="hint">Ask me anything — type and press Enter or Send</div>
  //         )}
  //         {messages.map((m, i) => (
  //           <div
  //             key={i}
  //             className={`message-row ${m.who === "user" ? "user" : "bot"}`}
  //           >
  //             <div
  //               className={`message-bubble ${m.who === "user" ? "bubble-user" : "bubble-bot"}`}
  //             >
  //               {m.text}
  //             </div>
  //           </div>
  //         ))}
  //       </div>

  //       <div className="composer">
  //         <textarea
  //           className="composer-input"
  //           value={input}
  //           onChange={(e) => setInput(e.target.value)}
  //           onKeyDown={onKeyDown}
  //           placeholder="Type your question..."
  //           rows={2}
  //           disabled={busy}
  //         />
  //         <button
  //           className="composer-send"
  //           onClick={sendMessage}
  //           disabled={busy}
  //           aria-disabled={busy}
  //         >
  //           {busy ? "Thinking..." : "Send"}
  //         </button>
  //       </div>
  //     </div>
  //   </div>
  // );
}
