import type { Artifact } from "../types/chat";

export function generatePreviewHtml(
  activeArt: Artifact,
  currentCode: string,
  isSvg: boolean,
  isMarkdown: boolean,
  isReact: boolean,
  lang: string
): string {
  if (!activeArt || isSvg || isMarkdown) return "";

  if (isReact) {
    let cleanedCode = currentCode;

    cleanedCode = cleanedCode.replace(
      /import\s+{(.*?)}\s+from\s+['"]lucide-react['"];?/g,
      "const {$1} = window.LucideReact || window.lucide || {};"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+{(.*?)}\s+from\s+['"]recharts['"];?/g,
      "const {$1} = window.Recharts || {};"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+React\s*,\s*{(.*?)}\s+from\s+['"]react['"];?/g,
      "const {$1} = React;"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+React\s+from\s+['"]react['"];?/g,
      ""
    );
    cleanedCode = cleanedCode.replace(
      /import\s+{(.*?)}\s+from\s+['"]react['"];?/g,
      "const {$1} = React;"
    );
    cleanedCode = cleanedCode.replace(/import\s+.*?from\s+['"].*?['"];?/g, "");

    cleanedCode = cleanedCode
      .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, "function $1")
      .replace(/export\s+default\s+/g, "const __DefaultExport__ = ")
      .replace(/export\s+(?:const|let|var|function|class)\s+/g, "");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.12/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Lucide UMD Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.min.js"></script>
  
  <!-- Recharts and dependency Prop-types -->
  <script src="https://unpkg.com/prop-types@15.8.1/prop-types.min.js"></script>
  <script src="https://unpkg.com/recharts/umd/Recharts.js"></script>

  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background: #181716;
      color: #edeae4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>

  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      if (String(message).includes("Script error.")) return false;
      window.parent.postMessage({
        type: 'iframe-error',
        message: message + ' (line ' + lineno + ')'
      }, '*');
      return false;
    };
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorMsg = args.map(arg => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(' ');
      if (errorMsg.includes("React DevTools")) return;
      window.parent.postMessage({
        type: 'iframe-error',
        message: errorMsg
      }, '*');
      originalConsoleError.apply(console, args);
    };
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    try {
      ${cleanedCode}

      let TargetComp = null;
      if (typeof __DefaultExport__ !== 'undefined') {
        TargetComp = __DefaultExport__;
      } else if (typeof App !== 'undefined') {
        TargetComp = App;
      } else if (typeof ModernCounter !== 'undefined') {
        TargetComp = ModernCounter;
      } else if (typeof Button !== 'undefined') {
        TargetComp = Button;
      }

      if (!TargetComp) {
        const possible = Object.keys(window).filter(k => /^[A-Z]/.test(k) && typeof window[k] === 'function');
        if (possible.length > 0) TargetComp = window[possible[0]];
      }

      if (TargetComp) {
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TargetComp));
      } else {
        document.getElementById('root').innerHTML = '<div style="color: #edeae4; padding: 1rem; text-align: center; font-size: 13.5px;">Component mounted successfully.</div>';
      }
    } catch (err) {
      document.getElementById('root').innerHTML = '<div style="color: #f08578; padding: 1rem; border: 1px solid #7d2d24; border-radius: 8px; font-size: 13px;"><b>Render Error:</b> ' + err.message + '</div>';
      window.parent.postMessage({
        type: 'iframe-error',
        message: err.message
      }, '*');
    }
  </script>
</body>
</html>`;
  }

  if (lang === "html" || currentCode.includes("<html") || currentCode.includes("<!DOCTYPE")) {
    let htmlCode = currentCode;
    const injection = `
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      if (String(message).includes("Script error.")) return false;
      window.parent.postMessage({
        type: 'iframe-error',
        message: message + ' (line ' + lineno + ')'
      }, '*');
      return false;
    };
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorMsg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      window.parent.postMessage({
        type: 'iframe-error',
        message: errorMsg
      }, '*');
      originalConsoleError.apply(console, args);
    };
  </script>`;
    if (htmlCode.includes("<head>")) {
      htmlCode = htmlCode.replace("<head>", "<head>" + injection);
    } else {
      htmlCode = injection + htmlCode;
    }
    return htmlCode;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      if (String(message).includes("Script error.")) return false;
      window.parent.postMessage({
        type: 'iframe-error',
        message: message + ' (line ' + lineno + ')'
      }, '*');
      return false;
    };
  </script>
  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background: #181716;
      color: #edeae4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  ${currentCode}
</body>
</html>`;
}
