import { codeSnippets } from "@/data/mock";
import CodeSnippet from "@/components/integrations/CodeSnippet";

export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="text-text-primary text-2xl font-semibold">
        Talos SDK — Zero-Trust Local Inference
      </h1>
      <p className="text-text-secondary mb-6">
        Get started with the Talos SDK for local threat inference.
      </p>
      <div className="space-y-6">
        {codeSnippets.map((snippet) => (
          <CodeSnippet
            key={snippet.title}
            title={snippet.title}
            code={snippet.code}
          />
        ))}
      </div>
    </div>
  );
}
