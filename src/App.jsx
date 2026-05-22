import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import productsData from "./products.json";

const Y = "#FFB300";
const B = "#1668F5";
const AFFILIATE_TAG = "swipeandsho03-21";

// ── Helpers ──────────────────────────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const withAffiliate = (url) => {
  if (!url) return `https://www.amazon.in/?tag=${AFFILIATE_TAG}`;
  if (url.includes('tag=')) return url.replace(/tag=[^&]*/, `tag=${AFFILIATE_TAG}`);
  return url + (url.includes('?') ? '&' : '?') + `tag=${AFFILIATE_TAG}`;
};

const PRICE_RANGES = [
  { label: "Any Price",        min: 0,    max: Infinity },
  { label: "Under ₹500",       min: 0,    max: 500 },
  { label: "₹500 – ₹1,500",    min: 500,  max: 1500 },
  { label: "₹1,500 – ₹3,000",  min: 1500, max: 3000 },
  { label: "Over ₹3,000",      min: 3000, max: Infinity },
];

function computeCategories(products) {
  const counts = {};
  products.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  const mainCats     = Object.keys(counts).filter(c => counts[c] >= 2).sort();
  const singletonCats = Object.keys(counts).filter(c => counts[c] === 1).sort();
  return { mainCats, singletonCats };
}

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

// ── Legal pages content ─────────────────────────────────────────────────────
const PRIVACY_CONTENT = (
  <>
    <h2>Privacy Policy</h2>
    <p><em>Last updated: 2026</em></p>

    <h3>Who we are</h3>
    <p>SwipeShop is a product discovery website operated as a participant in the Amazon Associates Program.
       Our website address is swipeshop-wheat.vercel.app.</p>

    <h3>What data we collect</h3>
    <p>We do not run our own backend or collect any personal information directly. Specifically:</p>
    <ul>
      <li>We do not require accounts or logins.</li>
      <li>We do not collect names, email addresses, or phone numbers.</li>
      <li>Your cart selections are stored in your browser's local storage on your own device and never sent to us.</li>
    </ul>

    <h3>Third-party services</h3>
    <p>When you click a product link, you are redirected to Amazon.in. Amazon may set cookies and collect
       data per their own privacy policy, including a cookie that identifies the click as originating from
       our Amazon Associates account. This allows us to earn a small commission on qualifying purchases at
       no extra cost to you.</p>
    <p>Our site is hosted on Vercel and its source code is on GitHub. Vercel may log anonymized
       request metadata (IP address, user-agent) per their standard hosting policy.</p>

    <h3>Cookies</h3>
    <p>We do not set any tracking or advertising cookies ourselves. Amazon may set cookies once you click
       through to their site.</p>

    <h3>Contact</h3>
    <p>Questions about this policy? Email: milanmishrarighter@gmail.com</p>
  </>
);

const TERMS_CONTENT = (
  <>
    <h2>Terms of Service</h2>
    <p><em>Last updated: 2026</em></p>

    <h3>Acceptance</h3>
    <p>By using SwipeShop you agree to these terms. If you do not agree, please discontinue use.</p>

    <h3>What SwipeShop is</h3>
    <p>SwipeShop is a product discovery website. We display products available for sale on Amazon.in
       and provide links so you can view or purchase them on Amazon directly. SwipeShop does not sell
       any products itself, does not process payments, and does not ship goods.</p>

    <h3>Affiliate disclosure</h3>
    <p>SwipeShop is a participant in the Amazon Services LLC Associates Program, an affiliate advertising
       program designed to provide a means for sites to earn advertising fees by advertising and linking
       to Amazon.in. As an Amazon Associate we earn from qualifying purchases. The price you pay on Amazon
       is unaffected by our commission.</p>

    <h3>Accuracy of product information</h3>
    <p>Product titles, prices, ratings, images and descriptions are sourced from publicly available
       information and may be out of date. Always confirm details on Amazon.in before purchasing. We
       make no warranty as to accuracy, availability, or fitness of any product.</p>

    <h3>Not affiliated with Amazon</h3>
    <p>SwipeShop is an independent website and is not endorsed by, sponsored by, or affiliated with
       Amazon.com, Inc. or its subsidiaries beyond the standard Amazon Associates Program. Amazon and
       all related logos are trademarks of Amazon.com, Inc.</p>

    <h3>Liability</h3>
    <p>SwipeShop is provided "as is" without warranty of any kind. We are not liable for any loss arising
       from the use of this site or from products purchased on Amazon through our links. Your transaction
       on Amazon is governed entirely by Amazon's own terms.</p>

    <h3>Changes</h3>
    <p>We may update these terms at any time. Continued use of the site means you accept the updated terms.</p>
  </>
);

function LegalModal({ kind, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200,
        display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:"22px 22px 0 0", maxHeight:"85vh", width:"100%",
        maxWidth:430, overflow:"auto", padding:"24px 22px 32px",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.12)",
        fontFamily:"'Barlow',sans-serif", lineHeight:1.55, color:"#333", fontSize:13.5,
      }}>
        <button onClick={onClose} style={{
          float:"right", background:"#F5F5F5", border:"none", color:"#666",
          width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:13, fontWeight:700,
        }}>✕</button>
        <style>{`
          .legal h2 { font-family:'Barlow Condensed'; font-weight:900; font-size:26px; color:#111; margin-bottom:6px; letter-spacing:-0.5px; }
          .legal h3 { font-family:'Barlow Condensed'; font-weight:800; font-size:17px; color:#111; margin:18px 0 6px; letter-spacing:-0.2px; }
          .legal p  { margin-bottom:10px; }
          .legal ul { margin:8px 0 10px 22px; }
          .legal li { margin-bottom:4px; }
        `}</style>
        <div className="legal">{kind === "privacy" ? PRIVACY_CONTENT : TERMS_CONTENT}</div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [filterCat,   setFilterCat]   = useState("All Categories");
  const [filterPrice, setFilterPrice] = useState(0);
  const [legalModal,  setLegalModal]  = useState(null);

  const { mainCats, singletonCats } = useMemo(() => computeCategories(productsData), []);
  const categoryList = useMemo(() => {
    const list = ["All Categories", ...mainCats];
    if (singletonCats.length > 0) list.push("Uncategorized");
    return list;
  }, [mainCats, singletonCats]);

  // Apply filters → produce the actual stack
  const filteredProducts = useMemo(() => {
    const range = PRICE_RANGES[filterPrice];
    return productsData.filter(p => {
      if (p.price < range.min || p.price > range.max) return false;
      if (filterCat === "All Categories") return true;
      if (filterCat === "Uncategorized")  return singletonCats.includes(p.cat);
      return p.cat === filterCat;
    });
  }, [filterCat, filterPrice, singletonCats]);

  const [stack, setStack] = useState(() => shuffle(filteredProducts));
  const [cart,  setCart]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("ss4_cart") || "[]"); } catch { return []; }
  });
  const [showCart, setShowCart] = useState(false);
  const [toast,    setToast]    = useState({ msg:"", on:false });

  const [draggingId, setDraggingId] = useState(null);
  const [offset,     setOffset]     = useState({ x:0, y:0 });
  const [exitingId,  setExitingId]  = useState(null);
  const [exitDir,    setExitDir]    = useState(null);

  const dragStart    = useRef({ x:0, y:0 });
  const isDragging   = useRef(false);
  const isExiting    = useRef(false);

  // When filters change, reshuffle into stack
  useEffect(() => {
    setStack(shuffle(filteredProducts));
    setExitingId(null);
    isExiting.current = false;
  }, [filteredProducts]);
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
    setExitingId(product.id);
    setExitDir(dir);

    if (dir === "right") {
      const exists = cartRef.current.find(p => p.id === product.id);
      if (!exists) { saveCart([...cartRef.current, product]); flash("🛒 Added to cart!"); }
      else flash("Already in cart");
    } else if (dir === "left") {
      flash("Skipped");
    } else if (dir === "down") {
      window.open(withAffiliate(product.amazonUrl), "_blank");
      flash("Opening Amazon...");
    } else {
      flash("🚩 Reported");
    }

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
  const visibleCards = stack.slice(0, 3);

  const getCardStyle = (p, index) => {
    const isTop     = index === 0;
    const isLeaving = p.id === exitingId;
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

    const vi = Math.max(0, visualIndex);
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
      `ASIN.${i+1}=${p.asin || "PLACEHOLDER"}&Quantity.${i+1}=1`).join("&");
    return `https://www.amazon.in/gp/aws/cart/add.html?${params}&tag=${AFFILIATE_TAG}`;
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
        select{ -webkit-appearance:none; -moz-appearance:none; appearance:none;
                background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%23999' d='M6 8L0 0h12z'/></svg>");
                background-repeat:no-repeat; background-position:right 10px center;
                padding-right:28px; }
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

      {/* ── AFFILIATE DISCLOSURE STRIP ── */}
      <div style={{ textAlign:"center", padding:"6px 14px",
        background:"#FFF8E6", color:"#8A6A00", fontSize:11, lineHeight:1.4,
        borderBottom:"1px solid #F5EAC8"
      }}>
        As an Amazon Associate we earn from qualifying purchases.
      </div>

      {/* ── FILTERS ── */}
      <div style={{ padding:"10px 14px 6px", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          style={{
            flex:1, minWidth:120, padding:"7px 28px 7px 12px", borderRadius:8,
            border:"1px solid #E5E5E5", background:"#FAFAFA", fontSize:12, color:"#333",
            fontFamily:"'Barlow',sans-serif", fontWeight:600, cursor:"pointer",
          }}>
          {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterPrice}
          onChange={e => setFilterPrice(parseInt(e.target.value))}
          style={{
            flex:1, minWidth:120, padding:"7px 28px 7px 12px", borderRadius:8,
            border:"1px solid #E5E5E5", background:"#FAFAFA", fontSize:12, color:"#333",
            fontFamily:"'Barlow',sans-serif", fontWeight:600, cursor:"pointer",
          }}>
          {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
        </select>
      </div>

      {/* ── CARD AREA ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"16px 18px 6px", minHeight:0 }}>
        {stack.length === 0 ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
            <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:26, color:"#111", marginBottom:8 }}>
              {filterCat === "All Categories" && filterPrice === 0
                ? "YOU'VE SEEN IT ALL"
                : "NO PRODUCTS MATCH"}
            </div>
            <div style={{ fontSize:14, color:"#AAA", marginBottom:24 }}>
              {filterCat === "All Categories" && filterPrice === 0
                ? "Check your cart for saved items"
                : "Try adjusting your filters"}
            </div>
            <button onClick={() => {
                setFilterCat("All Categories"); setFilterPrice(0);
                setStack(shuffle(productsData));
              }} style={{
              background:Y, color:"#000", border:"none", borderRadius:12,
              padding:"12px 32px", fontFamily:"'Barlow Condensed'",
              fontWeight:900, fontSize:18, cursor:"pointer", letterSpacing:1
            }}>RESET</button>
          </div>
        ) : (
          <div style={{
            width:"100%", maxWidth:380, position:"relative",
            aspectRatio:"3 / 4", overflow:"visible"
          }}>
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
                    display:"flex", flexDirection:"column",
                    ...cardStyle,
                  }}
                >
                  {/* Image — uses contain so square Amazon images aren't cropped */}
                  <div style={{ flex:"0 0 62%", position:"relative", background:"#fff",
                    overflow:"hidden", borderBottom:"1px solid #F4F4F4" }}>
                    <img
                      src={p.img} alt={p.title} draggable={false}
                      style={{
                        width:"100%", height:"100%", objectFit:"contain", padding:"12px",
                        filter: !isTop && !isLeaving ? "blur(1px)" : "none",
                        opacity: !isTop && !isLeaving ? 0.6 : 1,
                        transition: "filter 0.3s, opacity 0.3s"
                      }}
                    />

                    {(isTop || isLeaving) && (
                      <>
                        {p.badge && (
                          <div style={{ position:"absolute", top:10, left:10, background:Y, color:"#000",
                            padding:"3px 10px", borderRadius:4, fontSize:10, fontWeight:800, letterSpacing:0.6
                          }}>{p.badge.toUpperCase()}</div>
                        )}
                        <div style={{ position:"absolute", top:10, right:10, background:"rgba(255,255,255,0.92)",
                          color:"#777", padding:"3px 10px", borderRadius:4, fontSize:10, fontWeight:600,
                          maxWidth:"60%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                        }}>{p.cat}</div>

                        {swipeDir && isTop && !isLeaving && (
                          <div style={{ position:"absolute", inset:0, background:OVERLAYS[swipeDir].bg,
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <div style={{
                              border:`3px solid ${OVERLAYS[swipeDir].color}`, borderRadius:12, padding:"8px 22px",
                              transform: swipeDir==="right" ? "rotate(-12deg)" : swipeDir==="left" ? "rotate(12deg)" : "none",
                              background:"rgba(255,255,255,0.7)",
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

                  {/* Info section */}
                  {(isTop || isLeaving) ? (
                    <div style={{ flex:1, padding:"12px 16px 14px", overflow:"hidden" }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:19,
                        color:"#111", lineHeight:1.15, marginBottom:6,
                        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
                        overflow:"hidden",
                      }}>{p.title}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                        <Stars rating={p.rating}/>
                        <span style={{ color:"#C8C8C8", fontSize:12 }}>({p.reviews.toLocaleString()})</span>
                      </div>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:26,
                        color:B, marginBottom:6, letterSpacing:-0.5 }}>₹{p.price.toLocaleString('en-IN')}</div>
                      <p style={{ color:"#999", fontSize:12, lineHeight:1.5,
                        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
                        overflow:"hidden",
                      }}>{p.summary}</p>
                    </div>
                  ) : (
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
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:18, padding:"4px 0 8px" }}>
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
      <div style={{ padding:"4px 20px 14px" }}>
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

      {/* ── FOOTER ── */}
      <div style={{ borderTop:"1px solid #F2F2F2", padding:"10px 16px 16px",
        textAlign:"center", color:"#AAA", fontSize:11, lineHeight:1.6 }}>
        <div style={{ marginBottom:4 }}>
          <button onClick={() => setLegalModal("privacy")} style={{
            background:"none", border:"none", color:"#777", fontSize:11,
            cursor:"pointer", padding:"0 8px", borderRight:"1px solid #DDD",
          }}>Privacy</button>
          <button onClick={() => setLegalModal("terms")} style={{
            background:"none", border:"none", color:"#777", fontSize:11,
            cursor:"pointer", padding:"0 8px",
          }}>Terms</button>
        </div>
        <div style={{ color:"#BBB", fontSize:10 }}>
          SwipeShop is a participant in the Amazon Associates Program. We may earn from qualifying purchases.
        </div>
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
                      objectFit:"contain", background:"#FAFAFA", border:"1px solid #F0F0F0", padding:4 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#111", fontSize:13, fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{p.title}</div>
                      <div style={{ color:B, fontWeight:800, fontSize:15 }}>₹{p.price.toLocaleString('en-IN')}</div>
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
                      ₹{cart.reduce((s,p) => s+p.price, 0).toLocaleString('en-IN')}
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

      {legalModal && <LegalModal kind={legalModal} onClose={() => setLegalModal(null)} />}
      <Toast msg={toast.msg} on={toast.on} />
    </div>
  );
}
