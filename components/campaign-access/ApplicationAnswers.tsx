import { Link2 } from "lucide-react";
import { linkLabel, type ApplicationAnswer } from "@/lib/campaign-access";

export function AnswerValue({ kind, answer }: { kind: string; answer: string }) {
  if (kind === "url") {
    return (
      <a
        href={answer}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-[#7F39EC] underline dark:text-purple-300"
      >
        {answer}
      </a>
    );
  }
  if (kind === "yes_no") return <span>{answer === "yes" ? "Yes" : "No"}</span>;
  return <span className="whitespace-pre-wrap break-words">{answer}</span>;
}

/** Small chip for a link answer, showing only the site name. */
export function LinkChip({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-[#4A00BE] hover:underline dark:border-[#7F39EC]/40 dark:bg-[#2B1159] dark:text-purple-200"
    >
      <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{linkLabel(url)}</span>
    </a>
  );
}

export function AnswersList({ answers }: { answers: readonly ApplicationAnswer[] }) {
  if (answers.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No answers (this campaign had no questions).
      </p>
    );
  }
  return (
    <dl className="space-y-4">
      {answers.map((ans) => (
        <div key={ans.question_id}>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-100">{ans.prompt}</dt>
          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {ans.answer.trim() ? (
              <AnswerValue kind={ans.kind} answer={ans.answer} />
            ) : (
              <span className="text-gray-400 dark:text-gray-500">No answer</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
