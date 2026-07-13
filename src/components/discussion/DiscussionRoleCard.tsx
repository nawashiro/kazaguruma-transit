import { InformationCircleIcon } from "@heroicons/react/24/outline";

export type DiscussionRole = "user" | "moderator" | "admin";

interface DiscussionRoleCardProps {
  role: DiscussionRole;
}

export function DiscussionRoleCard({ role }: DiscussionRoleCardProps) {
  return (
    <div className="alert mb-8" role="status">
      <InformationCircleIcon className="h-6 w-6 text-info" aria-hidden="true" />
      <div>
        {role === "admin" ? (
          <>
            <p className="font-semibold ruby-text">あなたは管理人です。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 ruby-text">
              <li>ユーザーとして、会話に参加できます。</li>
              <li>モデレーターとして、会話の掲載申請を承認できます。</li>
              <li>管理人として、モデレーターを指名できます。</li>
            </ul>
          </>
        ) : role === "moderator" ? (
          <>
            <p className="font-semibold ruby-text">あなたはモデレーターです。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 ruby-text">
              <li>ユーザーとして、会話に参加できます。</li>
              <li>モデレーターとして、会話の掲載申請を承認できます。</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold ruby-text">あなたはユーザーです。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 ruby-text">
              <li>ユーザーとして、会話に参加できます。</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
