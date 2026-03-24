"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { motion } from "framer-motion";

interface CodeSnippetProps {
  title: string;
  code: string;
}

function highlightLine(line: string): React.ReactNode {
  if (line.trimStart().startsWith("#")) {
    return <span className="text-text-secondary">{line}</span>;
  }

  const parts: React.ReactNode[] = [];
  const regex = /(["'`])(?:(?!\1).)*\1/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="text-accent">
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : line;
}

export default function CodeSnippet({ title, code }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-text-primary text-sm font-medium">{title}</span>
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopy}>
          {copied ? (
            <span className="flex items-center gap-1 text-sm text-text-primary">
              <Check size={16} />
              Copied!
            </span>
          ) : (
            <Copy size={16} className="text-text-primary" />
          )}
        </motion.button>
      </div>
      <div className="bg-base p-4">
        <pre>
          <code className="font-mono text-sm text-text-primary whitespace-pre-wrap">
            {code.split("\n").map((line, i) => (
              <span key={i}>
                {highlightLine(line)}
                {i < code.split("\n").length - 1 ? "\n" : ""}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
