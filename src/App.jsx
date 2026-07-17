import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import productsData from "./products.json";
import categoriesData from "./categories.json";

// Build version injected by vite.config.js (commit SHA + build time)
// eslint-disable-next-line no-undef
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

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

// Build an Amazon search URL with similar products, stripping brand + filler from title
const similarUrl = (product) => {
  const words = (product.title || "")
    .split(/\s+/)
    .slice(1)                                          // drop brand (usually first word)
    .filter(w => w.length > 2 && !/^\d+$/.test(w))     // drop short/numeric junk
    .slice(0, 5)
    .join(' ');
  const query = words.length >= 8 ? words : (product.cat || product.title || "");
  return `https://www.amazon.in/s?k=${encodeURIComponent(query)}&tag=${AFFILIATE_TAG}`;
};

const withAffiliate = (url) => {
  if (!url) return `https://www.amazon.in/?tag=${AFFILIATE_TAG}`;
  if (url.includes('tag=')) return url.replace(/tag=[^&]*/, `tag=${AFFILIATE_TAG}`);
  return url + (url.includes('?') ? '&' : '?') + `tag=${AFFILIATE_TAG}`;
};

// Tries to open in Amazon app on mobile, falls back to web on desktop
const openAmazon = (amazonUrl, asin) => {
  const url = withAffiliate(amazonUrl || `https://www.amazon.in/dp/${asin}/`);
  const ua  = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS     = /iPad|iPhone|iPod/i.test(ua);

  if (isAndroid && asin) {
    // Android intent — opens Amazon app if installed, falls back to web
    const intent =
      `intent://www.amazon.in/dp/${asin}/?tag=${AFFILIATE_TAG}` +
      `#Intent;scheme=https;package=in.amazon.mShop.android.shopping;` +
      `S.browser_fallback_url=${encodeURIComponent(url)};end`;
    window.location.href = intent;
    return;
  }
  if (isIOS && asin) {
    // iOS — Amazon registers universal links for amazon.in domains
    // window.open in a new tab tends to bypass universal links, so use location
    window.location.href = url;
    return;
  }
  // Desktop — open in new tab
  window.open(url, "_blank");
};

// Past this zoom the card stage can't render usefully — show a message instead.
const ZOOM_MAX = 175;

const miniBtn = {
  background:"none", border:"1px solid #EEE", borderRadius:10,
  padding:"3px 10px", fontSize:8, color:"#AAA", letterSpacing:0.3,
  fontWeight:700, cursor:"pointer", fontFamily:"'Barlow',sans-serif",
  display:"inline-flex", alignItems:"center", gap:5,
  flex:"0 0 auto", whiteSpace:"nowrap",   // never squish — wrap to next line instead
};

// Compute the actual global price range from products
const ALL_PRICES = productsData.map(p => p.price || 0).filter(p => p > 0);
const PRICE_MIN  = Math.min(...ALL_PRICES, 0);
const PRICE_MAX  = Math.max(...ALL_PRICES, 10000);
const PRICE_FLOOR = Math.floor(PRICE_MIN / 100) * 100;
const PRICE_CEIL  = Math.ceil(PRICE_MAX / 100) * 100;

// (Legacy auto-category compute removed — using custom categoriesData now)

const EXIT = {
  right: "translate(160%,  -5%) rotate(32deg)",
  left:  "translate(-160%, -5%) rotate(-32deg)",
  up:    "translate(0, -150%) rotate(-5deg)",
  down:  "translate(0,  150%) rotate(5deg)",
};

const OVERLAYS = {
  right:{ label:"ADD TO CART",     color:"#00A550", bg:"rgba(0,165,80,0.09)"   },
  left: { label:"OPEN ON\nAMAZON", color:B,         bg:"rgba(22,104,245,0.09)" },
  up:   { label:"NEXT PRODUCT",    color:"#D0021B", bg:"rgba(208,2,27,0.09)"   },
  down: { label:"↩ PREVIOUS",      color:"#8B5CF6", bg:"rgba(139,92,246,0.09)" },
};

const SWIPE_THRESHOLD = 50;  // px — lower = snappier, easier to trigger

function Stars({ rating, size = 13 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? Y : "#E8E8E8"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      <span style={{ color:"#999", fontSize:size * 0.92, marginLeft:4 }}>{rating}</span>
    </div>
  );
}

// Toast component removed — no more toast bubbles on the site

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

const CONTACT_EMAIL = "hello@swipeshop.example.com";   // TODO: replace with real email

const CONTACT_CONTENT = (
  <>
    <h2>Contact Us</h2>
    <p>Want to complain about something, suggest an idea, or just get in touch? We'd love to hear from you.</p>
    <p>Email us at: <strong>{CONTACT_EMAIL}</strong></p>

    <h3>Report a problem</h3>
    <p>Spotted an incorrect price, a broken product link, or something inappropriate? You can tap the
       small warning icon on any product card to report it, or email us directly.</p>

    <h3>Sponsored products</h3>
    <p>Want your product featured on SwipeShop? Get in touch at the email above to discuss sponsored
       placement.</p>
    <p>Please note: sponsored products will appear with a clear <strong>"Sponsored"</strong> tag on
       the card so users always know it's a paid placement.</p>
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
        <div className="legal">{
          kind === "privacy" ? PRIVACY_CONTENT :
          kind === "terms"   ? TERMS_CONTENT   :
          CONTACT_CONTENT
        }</div>
      </div>
    </div>
  );
}

function SidebarMenu({ onClose, onSelect }) {
  const items = [
    { key: "contact", label: "Contact Us" },
    { key: "privacy", label: "Privacy Policy" },
    { key: "terms",   label: "Terms of Service" },
  ];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:210,
        display:"flex" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", width:"78%", maxWidth:300, height:"100%",
        boxShadow:"4px 0 30px rgba(0,0,0,0.15)", display:"flex", flexDirection:"column",
        fontFamily:"'Barlow',sans-serif",
        animation:"ssSlideIn 0.22s ease-out",
      }}>
        <style>{`@keyframes ssSlideIn { from { transform:translateX(-100%);} to { transform:translateX(0);} }`}</style>
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid #F2F2F2",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"baseline" }}>
            <span style={{ color:Y, fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:24, letterSpacing:-1 }}>SWIPE</span>
            <span style={{ color:"#111", fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:24, letterSpacing:-1 }}>SHOP</span>
          </div>
          <button onClick={onClose} style={{
            background:"#F5F5F5", border:"none", color:"#666", width:30, height:30,
            borderRadius:"50%", cursor:"pointer", fontSize:13, fontWeight:700 }}>✕</button>
        </div>
        <div style={{ padding:"10px 0", flex:1 }}>
          {items.map(it => (
            <button key={it.key} onClick={() => onSelect(it.key)} style={{
              display:"block", width:"100%", textAlign:"left", background:"none",
              border:"none", padding:"14px 22px", fontSize:15, color:"#222",
              fontWeight:600, cursor:"pointer", fontFamily:"'Barlow',sans-serif",
            }}>{it.label}</button>
          ))}
        </div>
        <div style={{ padding:"14px 22px", borderTop:"1px solid #F2F2F2",
          fontSize:11, color:"#BBB", lineHeight:1.5 }}>
          As an Amazon Associate we earn from qualifying purchases.
          <div style={{ marginTop:8, fontSize:9, color:"#D0D0D0", fontFamily:"monospace" }}>
            v{APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ product, onClose, onSubmit }) {
  const [text, setText] = useState("");
  const reasons = ["Wrong price", "Broken link", "Inappropriate", "Out of stock", "Other"];
  const [reason, setReason] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:220,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:18, width:"100%", maxWidth:340,
        padding:"20px 20px 18px", boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
        fontFamily:"'Barlow',sans-serif",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:20, color:"#111" }}>
            REPORT PRODUCT
          </span>
          <button onClick={onClose} style={{
            background:"#F5F5F5", border:"none", color:"#666", width:28, height:28,
            borderRadius:"50%", cursor:"pointer", fontSize:12, fontWeight:700 }}>✕</button>
        </div>
        <p style={{ fontSize:12, color:"#999", marginBottom:14, lineHeight:1.4 }}>
          {product.title}
        </p>

        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{
              background: reason === r ? "#FFF4ED" : "#F5F5F5",
              border: `1px solid ${reason === r ? "#FF6900" : "#EEE"}`,
              color: reason === r ? "#FF6900" : "#666",
              borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"'Barlow',sans-serif",
            }}>{r}</button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Tell us more (optional)..."
          style={{
            width:"100%", minHeight:70, padding:"9px 11px", border:"1px solid #E0E0E0",
            borderRadius:8, fontSize:13, fontFamily:"'Barlow',sans-serif", resize:"vertical",
            marginBottom:12, color:"#222", lineHeight:1.4,
          }}
        />

        <button onClick={() => onSubmit(reason, text)} disabled={!reason} style={{
          background: reason ? "#FF6900" : "#E8E8E8", color: reason ? "#fff" : "#AAA",
          border:"none", borderRadius:10, padding:"11px 0", width:"100%",
          fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:15, letterSpacing:0.5,
          cursor: reason ? "pointer" : "not-allowed",
        }}>SUBMIT REPORT</button>
      </div>
    </div>
  );
}

function ProductDetailModal({ product, onClose, onAddToCart, alreadyInCart }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200,
        display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:"22px 22px 0 0", maxHeight:"88vh", width:"100%",
        maxWidth:430, overflow:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.12)",
        fontFamily:"'Barlow',sans-serif",
      }}>
        {/* Close button */}
        <div style={{ position:"sticky", top:0, background:"#fff", zIndex:2,
          padding:"14px 18px 6px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"#999", fontSize:11, fontWeight:600, letterSpacing:0.5 }}>
            {product.cat?.toUpperCase()}
          </span>
          <button onClick={onClose} style={{
            background:"#F5F5F5", border:"none", color:"#666",
            width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:13, fontWeight:700,
          }}>✕</button>
        </div>

        {/* Image */}
        <div style={{ background:"#FAFAFA", padding:"14px 24px 20px",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={product.img} alt={product.title}
            style={{ width:"100%", maxWidth:300, maxHeight:300, objectFit:"contain" }} />
        </div>

        {/* Title + meta */}
        <div style={{ padding:"18px 22px 24px" }}>
          <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:22,
            color:"#111", lineHeight:1.2, marginBottom:10 }}>{product.title}</div>

          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Stars rating={product.rating}/>
            <span style={{ color:"#C8C8C8", fontSize:13 }}>
              ({product.reviews?.toLocaleString() ?? 0} reviews)
            </span>
          </div>

          <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32,
            color:B, marginBottom:12, letterSpacing:-0.5 }}>
            ₹{product.price?.toLocaleString('en-IN')}
          </div>

          {(product.categories || []).length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
              {(product.categories || []).map(name => {
                const cat = categoriesData.find(c => c.name === name);
                if (!cat) return null;
                return (
                  <span key={name} style={{
                    display:"inline-flex", alignItems:"center", gap:5,
                    background:"#F5F5F5", border:"1px solid #EEE",
                    borderRadius:14, padding:"4px 10px",
                    fontSize:12, color:"#555", fontWeight:600,
                  }}>
                    <span style={{ fontSize:14 }}>{cat.emoji}</span>
                    {cat.name}
                  </span>
                );
              })}
            </div>
          )}

          <p style={{ color:"#666", fontSize:14, lineHeight:1.6, marginBottom:24,
            whiteSpace:"pre-line" }}>{product.summary}</p>

          {/* Action buttons */}
          <button onClick={() => openAmazon(product.amazonUrl, product.asin)} style={{
            background:B, color:"#fff", border:"none", borderRadius:12,
            padding:"14px 0", width:"100%", fontFamily:"'Barlow Condensed'",
            fontWeight:900, fontSize:17, cursor:"pointer", letterSpacing:0.6,
            marginBottom:10,
          }}>OPEN ON AMAZON →</button>
          <button onClick={onAddToCart} style={{
            background: alreadyInCart ? "#F5F5F5" : Y, color: alreadyInCart ? "#999" : "#000",
            border:"none", borderRadius:12, padding:"12px 0", width:"100%",
            fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:15, cursor:"pointer",
            letterSpacing:0.6, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
            {alreadyInCart ? "ALREADY IN CART" : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
                </svg>
                ADD TO CART
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ZoomBlocked() {
  // Deliberately tiny: this renders inside an already-squeezed stage at high
  // zoom, so it must never be the thing that clips.
  return (
    <div style={{ textAlign:"center", padding:"0 8px", maxWidth:200,
      fontFamily:"'Barlow',sans-serif", overflow:"hidden" }}>
      <div style={{ fontSize:13, marginBottom:3, lineHeight:1 }}>🔍</div>
      <div style={{ fontSize:8, color:"#999", lineHeight:1.35, fontWeight:600 }}>
        Zoom out to display the website properly.
      </div>
    </div>
  );
}

function TutorialOverlay({ onDismiss }) {
  // Absorb the ENTIRE tap sequence (touchstart+touchmove+touchend+click) so nothing behind fires
  const kill = (e) => { e.preventDefault(); e.stopPropagation(); };
  const dismiss = (e) => { kill(e); onDismiss(); };
  return (
    <div
      onPointerDown={dismiss}
      onTouchStart={dismiss}
      onTouchMove={kill}
      onTouchEnd={kill}
      onMouseDown={dismiss}
      onClick={kill}
      style={{
        position:"fixed", inset:0, zIndex:250,
        background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Barlow',sans-serif", color:"#fff", padding:"20px",
        animation:"ssFadeIn 0.3s ease",
        touchAction:"none",
      }}>
      <style>{`
        @keyframes ssFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ssBounceY { 0%,100% { transform: translate(0,0);} 50% { transform: translate(0,-6px);} }
        @keyframes ssBounceYD { 0%,100% { transform: translate(0,0);} 50% { transform: translate(0,6px);} }
        @keyframes ssBounceX { 0%,100% { transform: translate(0,-50%);} 50% { transform: translate(-6px,-50%);} }
        @keyframes ssBounceXR { 0%,100% { transform: translate(0,-50%);} 50% { transform: translate(6px,-50%);} }
        .arw-up   { animation: ssBounceY 1.4s ease infinite; }
        .arw-down { animation: ssBounceYD 1.4s ease infinite; animation-delay: 0.35s; }
        .arw-left { animation: ssBounceX 1.4s ease infinite; animation-delay: 0.7s; }
        .arw-right{ animation: ssBounceXR 1.4s ease infinite; animation-delay: 1.05s; }
      `}</style>
      <div style={{ position:"relative", width:"100%", maxWidth:290, aspectRatio:"3/4",
        border:"2px dashed rgba(255,255,255,0.55)", borderRadius:20,
        display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column",
      }}>
        {/* All arrows/labels are now INSIDE the dotted box near their edge */}
        <div className="arw-up" style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center" }}>
          <div style={{ fontSize:22, lineHeight:1 }}>↑</div>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.8, color:"#FF9999", marginTop:2 }}>NEXT PRODUCT</div>
        </div>
        <div className="arw-down" style={{ position:"absolute", bottom:14, left:0, right:0, textAlign:"center" }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.8, color:"#C4B5FD", marginBottom:2 }}>PREVIOUS PRODUCT</div>
          <div style={{ fontSize:22, lineHeight:1 }}>↓</div>
        </div>
        <div className="arw-left" style={{ position:"absolute", left:10, top:"50%", textAlign:"center", width:70 }}>
          <div style={{ fontSize:22, lineHeight:1 }}>←</div>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.8, color:"#93C5FD", marginTop:2 }}>AMAZON</div>
        </div>
        <div className="arw-right" style={{ position:"absolute", right:10, top:"50%", textAlign:"center", width:70 }}>
          <div style={{ fontSize:22, lineHeight:1 }}>→</div>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.8, color:"#86EFAC", marginTop:2 }}>ADD TO CART</div>
        </div>

        <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:24,
          letterSpacing:-0.5, textAlign:"center", padding:"0 20px" }}>
          SWIPE THE CARD
        </div>
        <div style={{ fontSize:11, opacity:0.7, marginTop:6, textAlign:"center" }}>
          Tap anywhere to dismiss
        </div>
      </div>
    </div>
  );
}

function HowToModal({ onClose, onPreviewTutorial }) {
  const rows = [
    { color:"#D0021B", bg:"#FEF2F2", arrow:"↑", label:"NEXT PRODUCT",
      svg:(<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#D0021B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>) },
    { color:"#00A550", bg:"#EFFAF4", arrow:"→", label:"ADD TO CART",
      svg:(<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#00A550" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1.4"/>
          <circle cx="20" cy="21" r="1.4"/>
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
        </svg>) },
    { color:"#1668F5", bg:"#EEF3FF", arrow:"←", label:"OPEN ON AMAZON",
      svg:(<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#1668F5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5"/>
          <path d="M12 19l-7-7 7-7"/>
        </svg>) },
    { color:"#8B5CF6", bg:"#F4F0FF", arrow:"↓", label:"PREVIOUS PRODUCT",
      svg:(<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#8B5CF6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6"/>
          <path d="M3 13a9 9 0 1 0 3-6.7L3 9"/>
        </svg>) },
    { color:"#555", bg:"#F4F4F4", arrow:"TAP", label:"VIEW FULL DETAILS",
      svg:(<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#555" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11.2c0-2.2 1.5-3.2 3-3.2s3 1 3 3-3 3-3 5"/>
          <circle cx="12" cy="18" r="0.8" fill="#555"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>) },
  ];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:20, width:"100%", maxWidth:340,
        padding:"22px 22px 18px", boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
        fontFamily:"'Barlow',sans-serif",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:22, color:"#111", letterSpacing:-0.5 }}>
            HOW TO SWIPE
          </span>
          <button onClick={onClose} style={{
            background:"#F5F5F5", border:"none", color:"#666", width:28, height:28,
            borderRadius:"50%", cursor:"pointer", fontSize:12, fontWeight:700 }}>✕</button>
        </div>

        {rows.map((r, i) => (
          <div key={i} style={{
            display:"flex", alignItems:"center", gap:14,
            padding:"10px 12px", marginBottom:8, background:r.bg, borderRadius:12,
          }}>
            <div style={{ flex:"0 0 auto" }}>{r.svg}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"#999", fontWeight:700, letterSpacing:0.4, marginBottom:2 }}>
                {r.arrow === "TAP" ? "TAP CARD" : `SWIPE ${r.arrow}`}
              </div>
              <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:16, color:r.color, letterSpacing:-0.2 }}>
                {r.label}
              </div>
            </div>
          </div>
        ))}

        {onPreviewTutorial && (
          <button onClick={onPreviewTutorial} style={{
            width:"100%", marginTop:8, background:"#111", color:"#fff", border:"none",
            borderRadius:10, padding:"11px 0", fontSize:13, fontWeight:800,
            letterSpacing:0.6, cursor:"pointer", fontFamily:"'Barlow',sans-serif",
          }}>▶ PREVIEW TUTORIAL</button>
        )}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedCatNames, setSelectedCatNames] = useState([]);   // array of category names (empty = all)
  const [priceRange,  setPriceRange]  = useState([PRICE_FLOOR, PRICE_CEIL]);
  const [openFilter, setOpenFilter] = useState(null);  // null | "cat" | "price"
  const [legalModal,  setLegalModal]  = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  // find-similar expansion — keyed by product id
  const [findExpanded, setFindExpanded] = useState(null);
  const [showHowTo,   setShowHowTo]   = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);
  const [showMenu,    setShowMenu]    = useState(false);
  const [reportProduct, setReportProduct] = useState(null);

  // Apply filters → produce the actual stack
  const filteredProducts = useMemo(() => {
    const [lo, hi] = priceRange;
    return productsData.filter(p => {
      const price = p.price || 0;
      if (price < lo || price > hi) return false;
      if (selectedCatNames.length === 0) return true;
      const productCats = p.categories || [];
      return productCats.some(c => selectedCatNames.includes(c));
    });
  }, [selectedCatNames, priceRange]);

  const [stack, setStack] = useState(() => shuffle(filteredProducts));
  const [cart,  setCart]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("ss4_cart") || "[]"); } catch { return []; }
  });
  const [showCart, setShowCart] = useState(false);

  const [draggingId, setDraggingId] = useState(null);
  const [offset,     setOffset]     = useState({ x:0, y:0 });
  const [exitingId,  setExitingId]  = useState(null);
  const [exitDir,    setExitDir]    = useState(null);
  const [enterAnim,  setEnterAnim]  = useState(null);  // { id, dir, phase } — bring-back animation
  const [undoStack, setUndoStack] = useState([]);   // [{ product, dir }, ...] — most recent at end, max 15

  const dragStart    = useRef({ x:0, y:0 });
  const dragStartTime= useRef(0);
  const isDragging   = useRef(false);
  const isExiting    = useRef(false);

  // When filters change, reshuffle into stack
  useEffect(() => {
    setStack(shuffle(filteredProducts));
    setExitingId(null);
    isExiting.current = false;
  }, [filteredProducts]);

  // ── ADAPTIVE CARD SIZE ────────────────────────────────────────────────────
  // Measure the stage's CONTENT box (padding already excluded) and shrink the
  // card to fit it. Padding is asymmetric — more on top so the stacked-card
  // silhouettes peeking above still read as equidistant from the panels.
  const [stageEl, setStageEl]     = useState(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!stageEl) return;
    const measure = () => {
      // Border box (includes padding). Stage is flex:1 so this is driven by the
      // parent, not by its own padding — no feedback loop when padding changes.
      const w = stageEl.clientWidth;
      const h = stageEl.clientHeight;
      setStageSize(prev =>
        (Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1) ? prev : { w, h });
    };
    measure();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(measure); ro.observe(stageEl); }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const iv = setInterval(measure, 500);   // no zoom event exists — poll
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      clearInterval(iv);
    };
  }, [stageEl]);

  // Fixed padding — top is larger so the stacked-card peek reads as balanced.
  const PAD_TOP = 46, PAD_BOT = 14;
  const availH = Math.max(0, stageSize.h - PAD_TOP - PAD_BOT);
  const availW = Math.max(0, stageSize.w - 20);
  const cardH = Math.max(0, Math.min(availH, availW * (4 / 3), 460));
  const cardW = cardH * 0.75;
  // Card content scales with the card so it never overflows.
  const s = cardH > 0 ? Math.max(0.55, Math.min(1, cardH / 440)) : 1;

  // ── ZOOM GATE ─────────────────────────────────────────────────────────────
  // The card stage only renders correctly in a narrow zoom band. Detect the
  // browser zoom (outerWidth/innerWidth ratio — independent of screen size, so
  // small phones never trip it) and swap the stage for a message outside it.
  // Touch devices are exempt: pinch is already blocked by the viewport meta.
  const [zoomPct, setZoomPct] = useState(100);
  useEffect(() => {
    const isTouch = window.matchMedia?.("(pointer: coarse)")?.matches;
    if (isTouch) return;                       // phones/tablets: never gate
    const measure = () => {
      const ow = window.outerWidth, iw = window.innerWidth;
      if (!ow || !iw) return;
      const z = Math.round((ow / iw) * 100);
      if (z < 25 || z > 500) return;           // nonsense reading — ignore
      setZoomPct(prev => (Math.abs(prev - z) >= 2 ? z : prev));
    };
    measure();
    window.addEventListener("resize", measure);
    const iv = setInterval(measure, 400);      // no zoom event exists — poll
    return () => { window.removeEventListener("resize", measure); clearInterval(iv); };
  }, []);
  // Show the message when zoom is past the band OR when the measured space is
  // simply too small to render a usable card — so there's never a blank stage.
  const MIN_USABLE_CARD_H = 150;
  const stageMeasured = stageSize.h > 0;
  const cardTooSmall  = stageMeasured && cardH < MIN_USABLE_CARD_H;
  const zoomOK = zoomPct <= ZOOM_MAX && !cardTooSmall;

  // ── ZOOM LOCK ─────────────────────────────────────────────────────────────
  // Blocks every zoom path a browser lets us touch. (Desktop Ctrl+/- keyboard is
  // OS/browser-protected and can't be fully blocked, but we try the wheel + keys.)
  useEffect(() => {
    // Ctrl/Cmd + mouse-wheel zoom (works in all desktop browsers)
    const onWheel = (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    // Ctrl/Cmd + (+ / - / 0 / =) keyboard zoom (best-effort — some browsers ignore)
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", "_"].includes(e.key)) {
        e.preventDefault();
      }
    };
    // Safari pinch gesture events (desktop trackpad + iOS)
    const onGesture = (e) => e.preventDefault();
    // Block the double-tap-to-zoom on iOS (two taps <300ms apart)
    let lastTouch = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey, { passive: false });
    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("gestureend", onGesture, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Auto-tutorial: show once/twice on first visits, after 5s idle, only if cart is empty
  useEffect(() => {
    let count = 0;
    try { count = parseInt(localStorage.getItem("ss_tutorial_count") || "0") || 0; } catch {}
    if (count >= 2) return;
    if (cart.length > 0) return;
    let cancelled = false;
    const dismissKeys = ["mousedown", "touchstart", "keydown", "wheel"];
    const cancel = () => { cancelled = true; };
    dismissKeys.forEach(k => window.addEventListener(k, cancel, { once: true }));
    const t = setTimeout(() => {
      if (!cancelled) {
        setShowTutorial(true);
        try { localStorage.setItem("ss_tutorial_count", String(count + 1)); } catch {}
      }
    }, 5000);
    return () => {
      clearTimeout(t);
      dismissKeys.forEach(k => window.removeEventListener(k, cancel));
    };
  }, []);   // once on mount only

  // Drive the bring-back entrance animation: start off-screen → settle to center
  useEffect(() => {
    if (enterAnim?.phase === "start") {
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setEnterAnim(a => a ? { ...a, phase: "settle" } : null))
      );
      return () => cancelAnimationFrame(raf);
    }
    if (enterAnim?.phase === "settle") {
      const t = setTimeout(() => setEnterAnim(null), 450);
      return () => clearTimeout(t);
    }
  }, [enterAnim]);
  const exitTimer    = useRef(null);
  const cartRef      = useRef(cart);    cartRef.current = cart;
  const stackRef     = useRef(stack);   stackRef.current = stack;
  const offsetRef    = useRef(offset);  offsetRef.current = offset;
  const undoStackRef = useRef(undoStack); undoStackRef.current = undoStack;

  const saveCart = (c) => { localStorage.setItem("ss4_cart", JSON.stringify(c)); setCart(c); };

  const flash = () => {};   // toasts removed

  // ── CORE SWIPE ──────────────────────────────────────────────────────────────
  // right = add to cart, left = amazon, up = skip. (down handled by doUndo)
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
    } else if (dir === "up") {
      flash("Skipped");
    } else if (dir === "left") {
      openAmazon(product.amazonUrl, product.asin);
      flash("Opening Amazon...");
    }

    setUndoStack(prev => [...prev, { product, dir }].slice(-15));   // keep last 15 only

    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      setStack(prev => prev.filter(p => p.id !== product.id));
      setOffset({ x:0, y:0 });
      setExitingId(null);
      setExitDir(null);
      isExiting.current = false;
    }, 420);
  }, []);

  // Bring back the most-recently-swiped card, animating it IN from the direction it left.
  const doUndo = useCallback(() => {
    if (isExiting.current) return;
    const stackNow = undoStackRef.current;
    if (stackNow.length === 0) { flash("Nothing to bring back"); return; }
    const { product, dir } = stackNow[stackNow.length - 1];

    if (dir === "right") {
      saveCart(cartRef.current.filter(p => p.id !== product.id));
    }
    // Add to front (filter guarantees it appears exactly once)
    setStack(s => [product, ...s.filter(p => p.id !== product.id)]);
    setUndoStack(prev => prev.slice(0, -1));
    setEnterAnim({ id: product.id, dir, phase: "start" });
    flash("↩ Brought back");
  }, []);

  const trySwipe = useCallback((dx, dy) => {
    const product = stackRef.current[0];
    if (!product) { isDragging.current = false; setDraggingId(null); return; }
    const T = SWIPE_THRESHOLD;
    const reset = () => { setOffset({ x:0, y:0 }); isDragging.current = false; setDraggingId(null); };
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > ay) {
      if      (dx >  T) doSwipe("right", product);  // Right = Add to cart
      else if (dx < -T) doSwipe("left",  product);  // Left  = Amazon
      else reset();
    } else {
      if      (dy < -T) doSwipe("up", product);     // Up    = Skip
      else if (dy >  T) { reset(); doUndo(); }       // Down  = Bring back last card
      else reset();
    }
  }, [doSwipe, doUndo]);

  // Treat a quick, small-distance press-and-release as a TAP → open detail modal
  const handlePointerUp = useCallback((dx, dy) => {
    const dist = Math.sqrt(dx*dx + dy*dy);
    const duration = Date.now() - dragStartTime.current;
    if (dist < 8 && duration < 250) {
      // Tap — open product detail
      isDragging.current = false;
      setDraggingId(null);
      setOffset({ x: 0, y: 0 });
      const product = stackRef.current[0];
      if (product) setDetailProduct(product);
      return;
    }
    trySwipe(dx, dy);
  }, [trySwipe]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const onUp = (e) => {
      if (!isDragging.current) return;
      handlePointerUp(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  }, [handlePointerUp]);

  const onMouseDown = (e) => {
    if (isExiting.current) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragStartTime.current = Date.now();
    isDragging.current = true;
    setDraggingId(stackRef.current[0]?.id ?? null);
  };
  const onTouchStart = (e) => {
    if (isExiting.current) return;
    const t = e.touches[0];
    dragStart.current = { x: t.clientX, y: t.clientY };
    dragStartTime.current = Date.now();
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
    handlePointerUp(offsetRef.current.x, offsetRef.current.y);
  };

  const getSwipeDir = () => {
    const { x, y } = offset;
    // Overlay only shows when the user is REALLY holding far in a direction —
    // way past the commit threshold. So speed-swiping never flashes labels.
    const OVERLAY_AT = 110;
    if (Math.abs(x) < OVERLAY_AT && Math.abs(y) < OVERLAY_AT) return null;
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

    // Bring-back entrance: start off-screen at the exit position, then settle to center
    if (enterAnim && p.id === enterAnim.id) {
      if (enterAnim.phase === "start") {
        return {
          transform:  EXIT[enterAnim.dir],
          transition: "none",
          zIndex: 30,
        };
      }
      return {
        transform:  "translate(0, 0) rotate(0deg)",
        transition: "transform 0.45s cubic-bezier(0.2, 0.8, 0.3, 1)",
        zIndex: 30,
      };
    }

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
    const peekUp = (vi + 1) * 18;
    return {
      transform:  `translateY(-${peekUp}px) scale(${scale})`,
      // Smoothly glide background cards into place during exit OR bring-back (no snapping)
      transition: (exitingId || enterAnim) ? "transform 0.42s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none",
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
      background:"#fff", height:"100dvh", maxWidth:430,
      margin:"0 auto", display:"flex", flexDirection:"column",
      fontFamily:"'Barlow',sans-serif", userSelect:"none",
      position:"relative", overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html, body { background:#fff; height:100%; overflow:hidden; overscroll-behavior:none; touch-action:manipulation; }
        button:focus{outline:none;}
        select{ -webkit-appearance:none; -moz-appearance:none; appearance:none;
                background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%23999' d='M6 8L0 0h12z'/></svg>");
                background-repeat:no-repeat; background-position:right 10px center;
                padding-right:28px; }
        /* Dual range slider — thumbs interactive, tracks transparent (we draw our own) */
        input.range-thumb::-webkit-slider-runnable-track { background: transparent; border: none; height: 36px; }
        input.range-thumb::-moz-range-track             { background: transparent; border: none; height: 36px; }
        input.range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
          border-radius: 50%; background: #fff; border: 2px solid ${Y};
          box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: grab;
          pointer-events: auto; margin-top: 8px;
        }
        input.range-thumb::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          border: 2px solid ${Y}; box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: grab;
          pointer-events: auto;
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"10px 18px 8px",
        borderBottom:"1px solid #F2F2F2", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0, overflow:"hidden" }}>
          <button onClick={() => setShowMenu(true)} aria-label="Menu"
            style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#111" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div style={{ display:"flex", alignItems:"baseline" }}>
            <span style={{ color:Y, fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:27, letterSpacing:-1 }}>SWIPE</span>
            <span style={{ color:"#111", fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:27, letterSpacing:-1 }}>SHOP</span>
          </div>
        </div>
        <button onClick={() => setShowCart(true)}
          style={{ background:"none", border:"none", cursor:"pointer", position:"relative",
            padding:8, flex:"0 0 auto" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display:"block" }}
            stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
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

      {/* Affiliate disclosure strip removed from the main page per request —
          it still lives in the sidebar menu footer and the Terms page. */}

      {/* ── FILTERS (two separate buttons; panels overlay over cards) ── */}
      <div style={{ padding:"5px 12px 4px", display:"flex", gap:5,
        position:"relative", zIndex:50, flexWrap:"wrap" }}>
        <button
          onClick={() => setOpenFilter(v => v === "cat" ? null : "cat")}
          style={{
            flex:"1 1 120px", minWidth:120, padding:"5px 10px", borderRadius:9,
            border:`1px solid ${openFilter === "cat" ? "#FFB300" : "#EEE"}`,
            background: openFilter === "cat" ? "#FFF8E6" : "#F8F8F8",
            fontSize:10, color:"#333", fontFamily:"'Barlow',sans-serif",
            fontWeight:700, letterSpacing:0.3, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:6,
            whiteSpace:"nowrap",
          }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {selectedCatNames.length === 0 ? "ALL CATEGORIES" : `${selectedCatNames.length} CATEGORIES`}
          </span>
          <span style={{ color:"#999", fontSize:8 }}>{openFilter === "cat" ? "▲" : "▼"}</span>
        </button>
        <button
          onClick={() => setOpenFilter(v => v === "price" ? null : "price")}
          style={{
            flex:"1 1 120px", minWidth:120, padding:"5px 10px", borderRadius:9,
            border:`1px solid ${openFilter === "price" ? "#FFB300" : "#EEE"}`,
            background: openFilter === "price" ? "#FFF8E6" : "#F8F8F8",
            fontSize:10, color:"#333", fontFamily:"'Barlow',sans-serif",
            fontWeight:700, letterSpacing:0.3, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:6,
            whiteSpace:"nowrap",
          }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {(priceRange[0] === PRICE_FLOOR && priceRange[1] === PRICE_CEIL)
              ? "ANY PRICE"
              : `₹${priceRange[0]} – ₹${priceRange[1]}`}
          </span>
          <span style={{ color:"#999", fontSize:8 }}>{openFilter === "price" ? "▲" : "▼"}</span>
        </button>

      {openFilter && (
        <>
          {/* Full-screen backdrop that closes the panel and swallows taps on cards */}
          <div
            onClick={() => setOpenFilter(null)}
            onTouchStart={(e) => { e.stopPropagation(); setOpenFilter(null); }}
            style={{ position:"fixed", inset:0, zIndex:45, background:"transparent" }}
          />
          <div
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{
              position:"absolute", left:12, right:12, zIndex:60,
              background:"#fff", border:"1px solid #EEE",
              borderRadius:14, boxShadow:"0 8px 24px rgba(0,0,0,0.10)",
              padding:"12px 14px", maxHeight:"55vh", overflowY:"auto",
              // Anchored to the filter row itself — adapts to any header height
              top:"calc(100% + 2px)",
            }}>
            {openFilter === "cat" && (
              <>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {categoriesData.length === 0 && (
                    <span style={{ fontSize:12, color:"#AAA" }}>No categories yet.</span>
                  )}
                  {categoriesData.map(c => {
                    const on = selectedCatNames.includes(c.name);
                    return (
                      <button key={c.name}
                        onClick={() => setSelectedCatNames(prev =>
                          prev.includes(c.name) ? prev.filter(n => n !== c.name) : [...prev, c.name])}
                        style={{
                          background: on ? Y : "#fff", color: on ? "#000" : "#555",
                          border:`1px solid ${on ? Y : "#E5E5E5"}`,
                          borderRadius:14, padding:"4px 9px", fontSize:11,
                          fontWeight:600, cursor:"pointer", fontFamily:"'Barlow',sans-serif",
                          display:"inline-flex", alignItems:"center", gap:4,
                          transition:"all 0.15s",
                        }}>
                        <span style={{ fontSize:13 }}>{c.emoji}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  {selectedCatNames.length > 0 && (
                    <button onClick={() => setSelectedCatNames([])}
                      style={{ flex:1, background:"none", border:"1px solid #EEE", color:"#666",
                        borderRadius:8, padding:"7px 0", fontSize:11, fontWeight:700,
                        cursor:"pointer", fontFamily:"'Barlow',sans-serif" }}>
                      Clear
                    </button>
                  )}
                  <button onClick={() => setOpenFilter(null)}
                    style={{ flex:2, background:Y, border:"none", color:"#000",
                      borderRadius:8, padding:"7px 0", fontSize:12, fontWeight:800,
                      cursor:"pointer", fontFamily:"'Barlow',sans-serif", letterSpacing:0.5 }}>
                    CONFIRM
                  </button>
                </div>
              </>
            )}

            {openFilter === "price" && (
              <>
                <div style={{ fontSize:10, color:"#999", fontWeight:800, letterSpacing:0.5,
                  marginBottom:6, textTransform:"uppercase", display:"flex", justifyContent:"space-between" }}>
                  <span>Range</span>
                  <span style={{ color:B, fontWeight:800 }}>₹{priceRange[0]} – ₹{priceRange[1]}</span>
                </div>
                <div style={{ position:"relative", height:34 }}>
                  <div style={{ position:"absolute", top:15, left:0, right:0, height:4,
                    background:"#EEE", borderRadius:2 }} />
                  <div style={{ position:"absolute", top:15, height:4, borderRadius:2, background:Y,
                    left: `${((priceRange[0] - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100}%`,
                    right:`${100 - ((priceRange[1] - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100}%`,
                  }} />
                  <input type="range" min={PRICE_FLOOR} max={PRICE_CEIL} step={50}
                    value={priceRange[0]}
                    onChange={e => setPriceRange(([_, hi]) =>
                      [Math.min(parseInt(e.target.value), hi - 50), hi])}
                    style={{ position:"absolute", top:0, left:0, right:0, width:"100%",
                      background:"transparent", pointerEvents:"none", appearance:"none",
                      WebkitAppearance:"none", height:34, margin:0 }}
                    className="range-thumb" />
                  <input type="range" min={PRICE_FLOOR} max={PRICE_CEIL} step={50}
                    value={priceRange[1]}
                    onChange={e => setPriceRange(([lo, _]) =>
                      [lo, Math.max(parseInt(e.target.value), lo + 50)])}
                    style={{ position:"absolute", top:0, left:0, right:0, width:"100%",
                      background:"transparent", pointerEvents:"none", appearance:"none",
                      WebkitAppearance:"none", height:34, margin:0 }}
                    className="range-thumb" />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#BBB" }}>
                  <span>₹{PRICE_FLOOR}</span><span>₹{PRICE_CEIL}</span>
                </div>
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  {(priceRange[0] !== PRICE_FLOOR || priceRange[1] !== PRICE_CEIL) && (
                    <button onClick={() => setPriceRange([PRICE_FLOOR, PRICE_CEIL])}
                      style={{ flex:1, background:"none", border:"1px solid #EEE", color:"#666",
                        borderRadius:8, padding:"7px 0", fontSize:11, fontWeight:700,
                        cursor:"pointer", fontFamily:"'Barlow',sans-serif" }}>
                      Clear
                    </button>
                  )}
                  <button onClick={() => setOpenFilter(null)}
                    style={{ flex:2, background:Y, border:"none", color:"#000",
                      borderRadius:8, padding:"7px 0", fontSize:12, fontWeight:800,
                      cursor:"pointer", fontFamily:"'Barlow',sans-serif", letterSpacing:0.5 }}>
                    CONFIRM
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      </div>{/* end filter row (panel is anchored to it) */}

      {/* ── CENTER STAGE — card shrinks to always respect this padding.
             Top padding is larger to make room for the stacked-card peek. ── */}
      <div ref={setStageEl} style={{ flex:1, display:"flex", flexDirection:"column",
        justifyContent:"center", alignItems:"center",
        padding:`${PAD_TOP}px 10px ${PAD_BOT}px`, minHeight:0, overflow:"hidden",
        touchAction:"none", position:"relative" }}>
        {!zoomOK ? (
          <ZoomBlocked />
        ) : stack.length === 0 ? (
          <div style={{ textAlign:"center", margin:"auto" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:24, color:"#111", marginBottom:6 }}>
              {selectedCatNames.length === 0 && priceRange[0] === PRICE_FLOOR && priceRange[1] === PRICE_CEIL
                ? "YOU'VE SEEN IT ALL"
                : "NO PRODUCTS MATCH"}
            </div>
            <div style={{ fontSize:13, color:"#AAA", marginBottom:18 }}>
              {selectedCatNames.length === 0 && priceRange[0] === PRICE_FLOOR && priceRange[1] === PRICE_CEIL
                ? "Check your cart for saved items"
                : "Try adjusting your filters"}
            </div>
            <button onClick={() => {
                setSelectedCatNames([]); setPriceRange([PRICE_FLOOR, PRICE_CEIL]);
                setStack(shuffle(productsData));
              }} style={{
              background:Y, color:"#000", border:"none", borderRadius:12,
              padding:"12px 32px", fontFamily:"'Barlow Condensed'",
              fontWeight:900, fontSize:18, cursor:"pointer", letterSpacing:1
            }}>RESET</button>
          </div>
        ) : (
          <>
          {/* Hints + side icons commented out per request */}

          {/* MIDDLE ROW — just the fixed card, centered */}
          <div style={{ flex:"0 0 auto", display:"flex", alignItems:"center",
            justifyContent:"center" }}>

          {/* CARD — measured; shrinks so the padding above/below is always respected */}
          {cardH > 50 && (
          <div style={{
            width: cardW,
            height: cardH,
            position:"relative",
            overflow:"visible",
            touchAction:"none",
            flex:"0 0 auto",
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
                  <div style={{ flex:"0 0 47%", position:"relative", background:"#fff",
                    overflow:"hidden", borderBottom:"1px solid #F4F4F4" }}>
                    <img
                      src={p.img} alt={p.title} draggable={false}
                      style={{
                        width:"100%", height:"100%", objectFit:"contain", padding:"10px",
                        filter: !isTop && !isLeaving ? "blur(1px)" : "none",
                        opacity: !isTop && !isLeaving ? 0.6 : 1,
                        transition: "filter 0.3s, opacity 0.3s"
                      }}
                    />

                    {(isTop || isLeaving) && swipeDir && isTop && !isLeaving && (
                      <div style={{ position:"absolute", inset:0, background:OVERLAYS[swipeDir].bg,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <div style={{
                          border:`3px solid ${OVERLAYS[swipeDir].color}`, borderRadius:12, padding:"8px 22px",
                          transform: swipeDir==="right" ? "rotate(-12deg)" : swipeDir==="left" ? "rotate(12deg)" : "none",
                          background:"rgba(255,255,255,0.7)",
                        }}>
                          <span style={{ color:OVERLAYS[swipeDir].color, fontFamily:"'Barlow Condensed'",
                            fontSize:26, fontWeight:900, whiteSpace:"pre-line", textAlign:"center", display:"block"
                          }}>{OVERLAYS[swipeDir].label}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info section — scales with the card so it never overflows */}
                  {(isTop || isLeaving) ? (
                    <div style={{ flex:1, minHeight:0, padding:`${9*s}px ${13*s}px ${9*s}px`,
                      display:"flex", flexDirection:"column", overflow:"hidden" }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:18*s,
                        color:"#111", lineHeight:1.1, marginBottom:2*s,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                      }}>{p.title}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6*s, marginBottom:2*s }}>
                        <Stars rating={p.rating} size={13*s}/>
                        <span style={{ color:"#C8C8C8", fontSize:11*s }}>({p.reviews.toLocaleString()})</span>
                      </div>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:20*s,
                        color:B, marginBottom:3*s, letterSpacing:-0.3 }}>₹{p.price.toLocaleString('en-IN')}</div>
                      <p style={{ color:"#999", fontSize:11.5*s, lineHeight:1.35, margin:0,
                        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
                        overflow:"hidden",
                      }}>{p.summary}</p>
                      <span style={{ color:"#999", fontSize:10.5*s, fontWeight:600, marginTop:2*s,
                        textDecoration:"underline", textUnderlineOffset:2, flex:"0 0 auto" }}>
                        Read more
                      </span>

                      {/* Footer row pinned to bottom — can never collide with the text above */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        gap:6, marginTop:"auto", paddingTop:5*s }}>
                        <button
                          aria-label="Find similar products"
                          title="Find similar on Amazon"
                          onMouseDown={e => e.stopPropagation()}
                          onTouchStart={e => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); window.open(similarUrl(p), "_blank"); }}
                          style={{
                            background:"none", border:"1px solid #EEE", borderRadius:10,
                            cursor:"pointer", padding:`${3*s}px ${8*s}px`,
                            display:"flex", alignItems:"center", gap:4*s,
                            fontFamily:"'Barlow',sans-serif", flex:"0 0 auto",
                          }}
                        >
                          <svg width={10*s} height={10*s} viewBox="0 0 24 24" fill="none"
                            stroke="#BBB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="7"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          </svg>
                          <span style={{ fontSize:9*s, color:"#AAA", fontWeight:700, letterSpacing:0.3 }}>
                            FIND SIMILAR
                          </span>
                        </button>

                        {(() => {
                          const cats = (p.categories || [])
                            .map(name => categoriesData.find(c => c.name === name))
                            .filter(Boolean);
                          if (cats.length === 0) return <span/>;
                          const shown = cats.slice(0, 2);
                          const extra = cats.length - shown.length;
                          const sz = Math.round(22 * s);
                          return (
                            <div style={{ display:"flex", gap:4, flex:"0 0 auto" }}>
                              {shown.map(c => (
                                <div key={c.name} title={c.name} style={{
                                  background:"#fff", border:"1px solid #EEE", borderRadius:"50%",
                                  width:sz, height:sz, display:"flex", alignItems:"center",
                                  justifyContent:"center", fontSize:12*s, lineHeight:1,
                                  boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
                                }}>{c.emoji}</div>
                              ))}
                              {extra > 0 && (
                                <div style={{
                                  background:"#fff", border:"1px solid #EEE", borderRadius:sz/2,
                                  padding:`0 ${5*s}px`, height:sz, display:"flex", alignItems:"center",
                                  justifyContent:"center", fontSize:10*s, fontWeight:800, color:"#666",
                                  boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
                                }}>+{extra}</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding:"14px 18px" }}>
                      <div style={{ height:13, background:"#EBEBEB", borderRadius:4, marginBottom:9, width:"68%" }}/>
                      <div style={{ height:10, background:"#F2F2F2", borderRadius:4, width:"40%" }}/>
                    </div>
                  )}
                  {/* Report button temporarily disabled per user request */}
                </div>
              );
            })}
          </div>
          )}

          {/* Right side icon commented out per request */}

          </div>{/* end MIDDLE ROW */}
          </>
        )}
      </div>

      {/* ── SWIPE LEGEND — always rendered so the stage height never depends on
             whether the card or the zoom message is showing (that would oscillate) ── */}
      {stack.length > 0 && (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
          padding:"2px 12px 0", gap:10, flexWrap:"wrap" }}>
          {[
            { rot:0,   label:"NEXT",     color:"#D0021B" },
            { rot:180, label:"PREVIOUS", color:"#8B5CF6" },
            { rot:-90, label:"AMAZON",   color:"#1668F5" },
            { rot:90,  label:"CART",     color:"#00A550" },
          ].map(x => (
            <div key={x.label} style={{ display:"flex", alignItems:"center", gap:3,
              fontSize:8.5, color:"#BBB", fontWeight:700, letterSpacing:0.3,
              flex:"0 0 auto", whiteSpace:"nowrap" }}>
              {/* One arrow SVG rotated per direction — text glyphs (↑↓←→) sit on
                  different baselines, which made ← look lower than →. */}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke={x.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform:`rotate(${x.rot}deg)`, display:"block", flex:"0 0 auto" }}>
                <path d="M12 20V4"/>
                <path d="M5 11l7-7 7 7"/>
              </svg>
              {x.label}
            </div>
          ))}
        </div>
      )}

      {/* ── CART BUTTON + INSTRUCTIONS + LEGAL ── */}
      <div style={{ padding:"8px 16px 18px" }}>
        <button onClick={() => setShowCart(true)} style={{
          background: cart.length > 0 ? Y : "#F5F5F5",
          color: cart.length > 0 ? "#000" : "#C0C0C0",
          border:"none", borderRadius:12, padding:"12px 0", width:"100%",
          fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:17,
          cursor:"pointer", letterSpacing:1, transition:"all 0.3s ease",
          boxShadow: cart.length > 0 ? "0 4px 18px rgba(255,179,0,0.28)" : "none"
        }}>
          {cart.length > 0
            ? `VIEW CART — ${cart.length} ITEM${cart.length!==1?"S":""}`
            : "CART IS EMPTY"}
        </button>

        {stack.length > 0 && (
          <div style={{
            display:"flex", justifyContent:"center", alignItems:"center",
            marginTop:10, gap:6, flexWrap:"wrap",
          }}>
            <button onClick={() => setShowHowTo(true)} style={miniBtn}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="#AAA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <circle cx="12" cy="7.5" r="0.6" fill="#AAA"/>
              </svg>
              INSTRUCTIONS
            </button>

            <button onClick={() => {
                if (cart.length === 0) { flash("Cart is already empty"); return; }
                saveCart([]); flash("Cart cleared");
              }} style={miniBtn}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="#AAA" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="5" x2="19" y2="19"/>
                <line x1="19" y1="5" x2="5" y2="19"/>
              </svg>
              CLEAR CART
            </button>

            <button onClick={() => window.location.reload()} style={miniBtn}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="#AAA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7"/>
                <polyline points="21 3 21 9 15 9"/>
              </svg>
              RELOAD
            </button>

            <button onClick={doUndo}
              disabled={undoStack.length === 0}
              style={{ ...miniBtn, opacity: undoStack.length > 0 ? 1 : 0.5 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="#AAA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6"/>
                <path d="M3 13a9 9 0 1 0 3-6.7L3 9"/>
              </svg>
              UNDO{undoStack.length > 0 ? ` (${undoStack.length})` : ""}
            </button>
          </div>
        )}

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

      {showMenu && (
        <SidebarMenu
          onClose={() => setShowMenu(false)}
          onSelect={(key) => { setShowMenu(false); setLegalModal(key); }}
        />
      )}
      {reportProduct && (
        <ReportModal
          product={reportProduct}
          onClose={() => setReportProduct(null)}
          onSubmit={(reason, text) => {
            // No backend yet — just acknowledge. (Could email/log later.)
            console.log("Report:", reportProduct.asin, reason, text);
            setReportProduct(null);
            flash("🚩 Report submitted — thank you");
          }}
        />
      )}
      {legalModal && <LegalModal kind={legalModal} onClose={() => setLegalModal(null)} />}
      {showHowTo  && <HowToModal onClose={() => setShowHowTo(false)}
        onPreviewTutorial={() => { setShowHowTo(false); setShowTutorial(true); }} />}
      {showTutorial && <TutorialOverlay onDismiss={() => setShowTutorial(false)} />}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          alreadyInCart={cart.some(p => p.id === detailProduct.id)}
          onClose={() => setDetailProduct(null)}
          onAddToCart={() => {
            if (!cart.some(p => p.id === detailProduct.id)) {
              saveCart([...cart, detailProduct]);
              flash("🛒 Added to cart!");
            } else {
              flash("Already in cart");
            }
            setDetailProduct(null);
          }}
        />
      )}
    </div>
  );
}
