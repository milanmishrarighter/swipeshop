import { useState, useRef, useEffect, useCallback } from "react";

const Y = "#FFB300";
const B = "#1668F5";

const PRODUCTS = [
  { id:1, title:"Anker 65W USB-C Charger",   price:27.99,  rating:4.7, reviews:18423,
    summary:"Compact 65W USB-C charger with PowerIQ 3.0. Charges MacBook, iPhone and Android at full speed. Foldable plug, great for travel.",
    img:"https://picsum.photos/seed/anker65/400/430",   badge:"Amazon's Choice", cat:"Electronics" },
  { id:2, title:"Logitech MX Master 3S",      price:89.99,  rating:4.8, reviews:32110,
    summary:"Ultra-fast MagSpeed scrolling, 8K DPI tracking. Connects to 3 devices simultaneously. Works on any surface including glass.",
    img:"https://picsum.photos/seed/mxmouse3/400/430",  badge:"Best Seller",     cat:"Electronics" },
  { id:3, title:"Sony WH-1000XM5",            price:279.99, rating:4.6, reviews:45230,
    summary:"Industry-leading noise cancellation, 30hr battery, multipoint Bluetooth. Lightweight foldable design perfect for commuting.",
    img:"https://picsum.photos/seed/sonywh5/400/430",   badge:"Top Rated",       cat:"Audio"       },
  { id:4, title:"Kindle Paperwhite 16GB",     price:149.99, rating:4.7, reviews:89012,
    summary:"6.8\" glare-free display with adjustable warm light. Waterproof, 3-month battery life. Holds thousands of books.",
    img:"https://picsum.photos/seed/kindle16/400/430",  badge:"Amazon's Choice", cat:"Devices"     },
  { id:5, title:"Instant Pot Duo 7-in-1",     price:79.99,  rating:4.7, reviews:120340,
    summary:"Pressure cooker, slow cooker, rice cooker, steamer, sauté, yogurt maker, and food warmer all in one 6-quart pot.",
    img:"https://picsum.photos/seed/ipot71/400/430",    badge:"Best Seller",     cat:"Kitchen"     },
  { id:6, title:"Hydro Flask 32oz Bottle",    price:44.95,  rating:4.8, reviews:67890,
    summary:"TempShield double-wall insulation keeps drinks cold 24hrs, hot 12hrs. BPA-free, dishwasher safe. Leak-proof cap.",
    img:"https://picsum.photos/seed/hydflask2/400/430", badge:null,              cat:"Sports"      },
  { id:7, title:"Govee LED Strip 32.8ft",     price:34.99,  rating:4.4, reviews:28900,
    summary:"16 million colors, music sync, app and voice controlled. Works with Alexa & Google Home. Cuttable and connectable.",
    img:"https://picsum.photos/seed/goveestrip/400/430",badge:null,              cat:"Smart Home"  },
  { id:8, title:"Apple AirTag 4-Pack",        price:99.00,  rating:4.6, reviews:55120,
    summary:"Precision Finding with Ultra Wideband chip. One-tap setup, water resistant. 1-year replaceable battery life.",
    img:"https://picsum.photos/seed/airtag4pk/400/430", badge:"Amazon's Choice", cat:"Electronics" },
];

const EXIT = {
  right: "translate(160%,  -5%) rotate(32deg)",
  left:  "translate(-160%, -5%) rotate(-32deg)",
  up:    "translate(0, -150%) rotate(-5deg)",
  down:  "translate(0,  150%) rotate(5deg)",
};

const OVERLAYS = {
  right:{ label:"ADD TO CART",    color:"#00A550", bg:"rgba(0,165,80,0.09)"   },
  left: { label:"SKIP",           color:"#D0021B", bg:"rgba(208,2,27,0.09)"   },
  up:   { label:"REPORT",         color:"#FF6900", bg:"rgba(255,105,0,0.09)"  },
  down: { label:"OPEN ON\nAMAZON",color:B,         bg:"rgba(22,104,245,0.09)" },
};

function Stars({ rating }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? Y : "#E8E8E8"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      <span style={{ color:"#999", fontSize:12, marginLeft:4 }}>{rating}</span>
    </div>
  );
}

function Toast({ msg, on }) {
  return (
    <div style={{
      position:"fixed", bottom:94, left:"50%",
      transform:`translateX(-50%) translateY(${on?0:6}px)`,
      opacity:on?1:0, transition:"all 0.2s ease",
      background:"#111", color:"#fff", padding:"9px 22px", borderRadius:50,
      fontWeight:700, fontSize:13, zIndex:9999, pointerEvents:"none",
      whiteSpace:"nowrap", fontFamily:"'Barlow',sans-serif",
      boxShadow:"0 4px 20px rgba(0,0,0,0.15)"
    }}>{msg}</div>
  );
}

export default function App() {
  const [stack, setStack]       = useState(PRODUCTS);
  const [cart,  setCart]        = useState(() => {
    try { return JSON.parse(localStorage.getItem("ss4_cart") || "[]"); } catch { return []; }
  });
  const [showCart, setShowCart] = useState(false);
  const [toast,    setToast]    = useState({ msg:"", on:false });

  // Per-card drag + exit state, keyed by product id
  const [draggingId, setDraggingId] = useState(null);
  const [offset,     setOffset]     = useState({ x:0, y:0 });
  const [exitingId,  setExitingId]  = useState(null); // id of card currently flying out
  const [exitDir,    setExitDir]    = useState(null);

  const dragStart    = useRef({ x:0, y:0 });
  const isDragging   = useRef(false);
  const isExiting    = useRef(false); // sync guard
  const toastTimer   = useRef(null);
  const cartRef      = useRef(cart);    cartRef.current = cart;
  const stackRef     = useRef(stack);   stackRef.current = stack;
  const offsetRef    = useRef(offset);  offsetRef.current = offset;

  const saveCart = (c) => { localStorage.setItem("ss4_cart", JSON.stringify(c)); setCart(c); };

  const flash = (msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, on:true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, on:false })), 1800);
  };

  // ── CORE SWIPE ──────────────────────────────────────────────────────────────
  const doSwipe = useCallback((dir, product) => {
    if (isExiting.current) return;
    isExiting.current = true;

    isDragging.current = false;
    setDraggingId(null);

    // Kick off exit animation
    setExitingId(product.id);
    setExitDir(dir);

    // Cart / toast logic
    if (dir === "right") {
      const exists = cartRef.current.find(p => p.id === product.id);
      if (!exists) { saveCart([...cartRef.current, product]); flash("🛒 Added to cart!"); }
      else flash("Already in cart");
    } else if (dir === "left") {
      flash("Skipped");
    } else if (dir === "down") {
      window.open(product.amazonUrl || "https://amazon.com", "_blank");
      flash("Opening Amazon...");
    } else {
      flash("🚩 Reported");
    }

    // Remove card after animation finishes
    setTimeout(() => {
      setStack(prev => prev.filter(p => p.id !== product.id));
      setOffset({ x:0, y:0 });
      setExitingId(null);
      setExitDir(null);
      isExiting.current = false;
    }, 420);
  }, []);

  const trySwipe = useCallback((dx, dy) => {
    const product = stackRef.current[0];
    if (!product) { isDragging.current = false; setDraggingId(null); return; }
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > ay) {
      if      (dx >  78) doSwipe("right", product);
      else if (dx < -78) doSwipe("left",  product);
      else { setOffset({ x:0, y:0 }); isDragging.current = false; setDraggingId(null); }
    } else {
      if      (dy >  78) doSwipe("down", product);
      else if (dy < -78) doSwipe("up",   product);
      else { setOffset({ x:0, y:0 }); isDragging.current = false; setDraggingId(null); }
    }
  }, [doSwipe]);

  // Document-level mouse so drag never breaks when leaving card bounds
  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const onUp = (e) => {
      if (!isDragging.current) return;
      trySwipe(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  }, [trySwipe]);

  const onMouseDown = (e) => {
    if (isExiting.current) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    isDragging.current = true;
    setDraggingId(stackRef.current[0]?.id ?? null);
  };
  const onTouchStart = (e) => {
    if (isExiting.current) return;
    const t = e.touches[0];
    dragStart.current = { x: t.clientX, y: t.clientY };
    isDragging.current = true;
    setDraggingId(stackRef.current[0]?.id ?? null);
  };
  const onTouchMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.current.x, y: t.clientY - dragStart.current.y });
  };
  const onTouchEnd = () => {
    if (!isDragging.current) return;
    trySwipe(offsetRef.current.x, offsetRef.current.y);
  };

  const getSwipeDir = () => {
    const { x, y } = offset;
    if (Math.abs(x) < 25 && Math.abs(y) < 25) return null;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
    return y > 0 ? "down" : "up";
  };
  const swipeDir = draggingId ? getSwipeDir() : null;

  // ── CARD STYLE CALCULATOR ────────────────────────────────────────────────────
  // Render up to 3 cards. Each has a persistent key = product.id.
  // When the top card exits, background cards smoothly promote forward.
  // Because keys are stable, React reuses the same DOM node — no jump.
  const visibleCards = stack.slice(0, 3);

  const getCardStyle = (p, index) => {
    const isTop     = index === 0;
    const isLeaving = p.id === exitingId;
    // While a card is exiting, remaining cards shift one step forward
    const visualIndex = (exitingId && !isLeaving) ? index - 1 : index;

    if (isLeaving) {
      return {
        transform:  EXIT[exitDir],
        transition: "transform 0.42s cubic-bezier(0.4, 0, 1, 1)",
        zIndex: 20,
        pointerEvents: "none",
      };
    }

    if (isTop && !exitingId) {
      if (isDragging.current && draggingId === p.id) {
        return {
          transform:  `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 22}deg)`,
          transition: "none",
          zIndex: 10,
        };
      }
      return {
        transform:  "translate(0, 0) rotate(0deg)",
        transition: "transform 0.38s ease-out",
        zIndex: 10,
      };
    }

    // Background card — peek from the top like stacked folders
    const vi = Math.max(0, visualIndex);

    // KEY FIX: when a card is exiting, the card that will become the new top
    // (vi === 0) must animate INTO the top-card position so there's no pop.
    if (exitingId && vi === 0) {
      return {
        transform:  "translate(0, 0) rotate(0deg)",
        transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1)",
        zIndex: 9,
        pointerEvents: "none",
      };
    }

    const scale  = 1 - (vi + 1) * 0.044;
    const peekUp = (vi + 1) * 22;
    return {
      transform:  `translateY(-${peekUp}px) scale(${scale})`,
      transition: exitingId ? "transform 0.4s ease" : "none",
      zIndex: 10 - index,
      pointerEvents: "none",
    };
  };

  const buildCartUrl = () => {
    const params = cartRef.current.map((p, i) =>
      `ASIN.${i+1}=PLACEHOLDER&Quantity.${i+1}=1`).join("&");
    return `https://www.amazon.com/gp/aws/cart/add.html?${params}&tag=yourtag-20`;
  };

  return (
    <div style={{
      background:"#fff", minHeight:"100vh", maxWidth:430,
      margin:"0 auto", display:"flex", flexDirection:"column",
      fontFamily:"'Barlow',sans-serif", userSelect:"none",
      position:"relative", overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#fff;}
        button:focus{outline:none;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"18px 22px 14px", borderBottom:"1px solid #F2F2F2" }}>
        <div style={{ display:"flex", alignItems:"baseline" }}>
          <span style={{ color:Y, fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:27, letterSpacing:-1 }}>SWIPE</span>
          <span style={{ color:"#111", fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:27, letterSpacing:-1 }}>SHOP</span>
          <span style={{ color:"#CCC", fontSize:11, marginLeft:8 }}>{stack.length} left</span>
        </div>
        <button onClick={() => setShowCart(true)}
          style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          {cart.length > 0 && (
            <div style={{ position:"absolute", top:3, right:3, background:Y, color:"#000",
              borderRadius:"50%", width:18, height:18, display:"flex",
              alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:800, border:"2px solid #fff"
            }}>{cart.length}</div>
          )}
        </button>
      </div>

      <div style={{ textAlign:"center", padding:"10px 0 4px", color:"#AAA", fontSize:12 }}>
        Saving swipes to <span style={{ color:Y, fontWeight:700 }}>Your Cart</span>
      </div>

      {/* ── CARD AREA ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"36px 20px 6px" }}>
        {stack.length === 0 ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
            <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:26, color:"#111", marginBottom:8 }}>
              YOU'VE SEEN IT ALL
            </div>
            <div style={{ fontSize:14, color:"#AAA", marginBottom:24 }}>Check your cart for saved items</div>
            <button onClick={() => setStack(PRODUCTS)} style={{
              background:Y, color:"#000", border:"none", borderRadius:12,
              padding:"12px 32px", fontFamily:"'Barlow Condensed'",
              fontWeight:900, fontSize:18, cursor:"pointer", letterSpacing:1
            }}>START OVER</button>
          </div>
        ) : (
          <div style={{ width:"100%", maxWidth:390, position:"relative", height:450, overflow:"visible" }}>

            {/* Render all visible cards with stable keys */}
            {[...visibleCards].reverse().map((p) => {
              const index     = visibleCards.indexOf(p);
              const isTop     = index === 0;
              const isLeaving = p.id === exitingId;
              const cardStyle = getCardStyle(p, index);
              const showDrag  = isTop && !isLeaving;
              const drag      = showDrag && draggingId === p.id;

              return (
                <div
                  key={p.id}
                  onMouseDown={showDrag ? onMouseDown : undefined}
                  onTouchStart={showDrag ? onTouchStart : undefined}
                  onTouchMove={showDrag ? onTouchMove : undefined}
                  onTouchEnd={showDrag ? onTouchEnd : undefined}
                  style={{
                    position:"absolute", width:"100%", height:"100%",
                    background:"#fff", borderRadius:20, overflow:"hidden",
                    cursor: showDrag ? (drag ? "grabbing" : "grab") : "default",
                    boxShadow: isTop
                      ? (drag ? "0 8px 24px rgba(0,0,0,0.12)" : "0 3px 14px rgba(0,0,0,0.08)")
                      : "0 2px 8px rgba(0,0,0,0.06)",
                    border:"1px solid #EBEBEB",
                    willChange:"transform",
                    ...cardStyle,
                  }}
                >
                  {/* Image section */}
                  <div style={{ height:"54%", position:"relative", background:"#F8F8F8", overflow:"hidden" }}>
                    <img
                      src={p.img} alt={p.title} draggable={false}
                      style={{
                        width:"100%", height:"100%", objectFit:"cover",
                        // Blur bg cards slightly
                        filter: !isTop && !isLeaving ? "blur(1px)" : "none",
                        opacity: !isTop && !isLeaving ? 0.6 : 1,
                        transition: "filter 0.3s, opacity 0.3s"
                      }}
                    />
                    {/* Fade into card body */}
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:60,
                      background:"linear-gradient(transparent,#fff)" }}/>

                    {/* Only show details on top / leaving card */}
                    {(isTop || isLeaving) && (
                      <>
                        {p.badge && (
                          <div style={{ position:"absolute", top:12, left:12, background:Y, color:"#000",
                            padding:"3px 10px", borderRadius:4, fontSize:10, fontWeight:800, letterSpacing:0.6
                          }}>{p.badge.toUpperCase()}</div>
                        )}
                        <div style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.9)",
                          color:"#777", padding:"3px 10px", borderRadius:4, fontSize:10, fontWeight:600
                        }}>{p.cat}</div>

                        {/* Swipe overlay */}
                        {swipeDir && isTop && !isLeaving && (
                          <div style={{ position:"absolute", inset:0, background:OVERLAYS[swipeDir].bg,
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <div style={{
                              border:`3px solid ${OVERLAYS[swipeDir].color}`, borderRadius:12, padding:"8px 22px",
                              transform: swipeDir==="right" ? "rotate(-12deg)" : swipeDir==="left" ? "rotate(12deg)" : "none"
                            }}>
                              <span style={{ color:OVERLAYS[swipeDir].color, fontFamily:"'Barlow Condensed'",
                                fontSize:28, fontWeight:900, whiteSpace:"pre-line", textAlign:"center", display:"block"
                              }}>{OVERLAYS[swipeDir].label}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Info section — only full detail on top/leaving card */}
                  {(isTop || isLeaving) ? (
                    <div style={{ padding:"13px 18px 16px" }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:21,
                        color:"#111", lineHeight:1.15, marginBottom:7 }}>{p.title}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                        <Stars rating={p.rating}/>
                        <span style={{ color:"#C8C8C8", fontSize:12 }}>({p.reviews.toLocaleString()})</span>
                      </div>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:30,
                        color:B, marginBottom:8, letterSpacing:-0.5 }}>${p.price.toFixed(2)}</div>
                      <p style={{ color:"#999", fontSize:12.5, lineHeight:1.55 }}>{p.summary}</p>
                    </div>
                  ) : (
                    // Skeleton for bg cards
                    <div style={{ padding:"14px 18px" }}>
                      <div style={{ height:13, background:"#EBEBEB", borderRadius:4, marginBottom:9, width:"68%" }}/>
                      <div style={{ height:10, background:"#F2F2F2", borderRadius:4, width:"40%" }}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:18, padding:"4px 0 10px" }}>
        {[
          { label:"Skip",   icon:"✕", color:"#D0021B", bg:"#FEF2F2", dir:"left"  },
          { label:"Amazon", icon:"↓", color:B,         bg:"#EEF3FF", dir:"down"  },
          { label:"Report", icon:"↑", color:"#FF6900", bg:"#FFF4ED", dir:"up"    },
          { label:"Add",    icon:"♥", color:"#00A550", bg:"#EFFAF4", dir:"right" },
        ].map(({ label, icon, color, bg, dir:d }) => (
          <div key={label} style={{ textAlign:"center" }}>
            <button
              onClick={() => { if (stack[0] && !isExiting.current) doSwipe(d, stack[0]); }}
              style={{ width:52, height:52, borderRadius:"50%", border:`2px solid ${color}`,
                background:bg, color, fontSize:20, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                marginBottom:5, transition:"transform 0.15s, box-shadow 0.15s",
                boxShadow:"0 2px 8px rgba(0,0,0,0.06)"
              }}
              onMouseEnter={e => { e.currentTarget.style.transform="scale(1.12)"; e.currentTarget.style.boxShadow=`0 6px 18px ${color}44`; }}
              onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; }}
            >{icon}</button>
            <div style={{ color:"#C8C8C8", fontSize:10, letterSpacing:0.5, fontWeight:600 }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* ── CART BUTTON ── */}
      <div style={{ padding:"4px 20px 24px" }}>
        <button onClick={() => setShowCart(true)} style={{
          background: cart.length > 0 ? Y : "#F5F5F5",
          color: cart.length > 0 ? "#000" : "#C0C0C0",
          border:"none", borderRadius:12, padding:"14px 0", width:"100%",
          fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:18,
          cursor:"pointer", letterSpacing:1, transition:"all 0.3s ease",
          boxShadow: cart.length > 0 ? "0 4px 20px rgba(255,179,0,0.28)" : "none"
        }}>
          {cart.length > 0
            ? `VIEW CART — ${cart.length} ITEM${cart.length!==1?"S":""}`
            : "CART IS EMPTY"}
        </button>
      </div>

      {/* ── CART DRAWER ── */}
      {showCart && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
          onClick={() => setShowCart(false)}>
          <div style={{ background:"#fff", borderRadius:"22px 22px 0 0", maxHeight:"82vh",
            overflow:"auto", padding:"24px 22px 36px", boxShadow:"0 -8px 40px rgba(0,0,0,0.12)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div>
                <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:26, color:"#111" }}>YOUR CART</span>
                {cart.length > 0 &&
                  <span style={{ color:Y, fontSize:14, marginLeft:10, fontWeight:700 }}>
                    {cart.length} item{cart.length!==1?"s":""}
                  </span>}
              </div>
              <button onClick={() => setShowCart(false)}
                style={{ background:"#F5F5F5", border:"none", color:"#999", width:32, height:32,
                  borderRadius:"50%", cursor:"pointer", fontSize:13, fontWeight:700 }}>✕</button>
            </div>

            {cart.length === 0 ? (
              <div style={{ textAlign:"center", padding:"44px 0" }}>
                <div style={{ fontSize:46, marginBottom:14 }}>🛒</div>
                <div style={{ color:"#BBB", fontSize:14 }}>Swipe right to add products here</div>
              </div>
            ) : (
              <>
                {cart.map(p => (
                  <div key={p.id} style={{ display:"flex", gap:14, padding:"14px 0",
                    borderBottom:"1px solid #F5F5F5", alignItems:"center" }}>
                    <img src={p.img} alt={p.title} style={{ width:60, height:60, borderRadius:10,
                      objectFit:"cover", border:"1px solid #F0F0F0" }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#111", fontSize:13, fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{p.title}</div>
                      <div style={{ color:B, fontWeight:800, fontSize:15 }}>${p.price.toFixed(2)}</div>
                    </div>
                    <button onClick={() => saveCart(cart.filter(x => x.id !== p.id))}
                      style={{ background:"#F5F5F5", border:"none", color:"#BBB",
                        width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:12 }}>✕</button>
                  </div>
                ))}

                <div style={{ marginTop:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"14px 0",
                    borderBottom:"1px solid #F0F0F0", marginBottom:18 }}>
                    <span style={{ color:"#AAA", fontSize:14 }}>Estimated total</span>
                    <span style={{ color:B, fontWeight:900, fontSize:22, fontFamily:"'Barlow Condensed'" }}>
                      ${cart.reduce((s,p) => s+p.price, 0).toFixed(2)}
                    </span>
                  </div>
                  <button onClick={() => window.open(buildCartUrl(), "_blank")} style={{
                    background:Y, color:"#000", border:"none", borderRadius:12,
                    padding:"15px 0", width:"100%", fontFamily:"'Barlow Condensed'",
                    fontWeight:900, fontSize:20, cursor:"pointer", letterSpacing:1,
                    marginBottom:10, boxShadow:"0 4px 20px rgba(255,179,0,0.28)"
                  }}>CHECKOUT ON AMAZON →</button>
                  <p style={{ color:"#CCC", fontSize:11, textAlign:"center" }}>
                    All items added to your Amazon cart at once · Prices may vary
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toast msg={toast.msg} on={toast.on} />
    </div>
  );
}
