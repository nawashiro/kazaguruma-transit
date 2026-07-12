"use client";

import type { ModeratorApplication } from "@/lib/discussion/moderator-application-state";
import { formatBip39JapaneseMnemonicPreviewFromPubkey } from "@/lib/nostr/mnemonic-utils";
import { formatRelativeTime, hexToNpub } from "@/lib/nostr/nostr-utils";
import type { DiscussionModerator } from "@/types/discussion";

interface Props {
  moderators: DiscussionModerator[];
  applications: ModeratorApplication[];
  applicationsByPubkey: Map<string, ModeratorApplication>;
  isCreator: boolean;
  approvedPubkeys: Set<string>;
  removedPubkeys: Set<string>;
  onToggleApproval: (pubkey: string) => void;
  onToggleRemoval: (pubkey: string) => void;
}

function Identity({ pubkey }: { pubkey: string }) {
  return (
    <div className="min-w-0">
      <p className="text-base font-bold ruby-text">
        {formatBip39JapaneseMnemonicPreviewFromPubkey(pubkey)}
      </p>
      <p className="font-mono break-all flex-1">{hexToNpub(pubkey)}</p>
    </div>
  );
}

function Selection({
  label,
  checked,
  onChange,
  pubkey,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  pubkey: string;
}) {
  return (
    <label className="flex shrink-0 flex-col items-center gap-2 text-sm font-medium">
      <span className="ruby-text">{label}</span>
      <input
        aria-label={`${formatBip39JapaneseMnemonicPreviewFromPubkey(pubkey)} を${label}対象にする`}
        className="checkbox checkbox-primary h-6 w-6 shrink-0"
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}

function Reason({ application }: { application?: ModeratorApplication }) {
  if (!application)
    return (
      <p className="mt-3 text-sm text-base-content/70 ruby-text">
        会話作成者による直接追加
      </p>
    );
  return (
    <div className="mt-3 space-y-1">
      <p className="text-base whitespace-pre-wrap ruby-text">
        申請理由: {application.reason || "未記入"}
      </p>
      <p className="text-sm text-base-content/70 ruby-text">
        申請日時 {formatRelativeTime(application.createdAt)}
      </p>
    </div>
  );
}

export function ModeratorManagementSection({
  moderators,
  applications,
  applicationsByPubkey,
  isCreator,
  approvedPubkeys,
  removedPubkeys,
  onToggleApproval,
  onToggleRemoval,
}: Props) {
  return (
    <section className="space-y-8">
      <section
        className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
        aria-labelledby="active-moderators-title"
      >
        <div className="card-body">
          <h2
            id="active-moderators-title"
            className="card-title mb-4 ruby-text"
          >
            モデレーターをしているユーザー
          </h2>
          {moderators.length === 0 ? (
            <p className="text-base-content/70 ruby-text">
              モデレーターはいません。
            </p>
          ) : (
            <div className="space-y-4">
              {moderators.map((moderator) => (
                <article
                  key={moderator.pubkey}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Identity pubkey={moderator.pubkey} />
                      <Reason
                        application={applicationsByPubkey.get(moderator.pubkey)}
                      />
                    </div>
                    {isCreator && (
                      <Selection
                        label="削除"
                        checked={removedPubkeys.has(moderator.pubkey)}
                        onChange={() => onToggleRemoval(moderator.pubkey)}
                        pubkey={moderator.pubkey}
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <section
        className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
        aria-labelledby="pending-moderators-title"
      >
        <div className="card-body">
          <h2
            id="pending-moderators-title"
            className="card-title mb-4 ruby-text"
          >
            <span>申請中のユーザー</span>
          </h2>
          {applications.length === 0 ? (
            <p className="text-base-content/70 ruby-text">
              申請中のユーザーはいません。
            </p>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <article
                  key={application.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Identity pubkey={application.applicantPubkey} />
                      <Reason application={application} />
                    </div>
                    {isCreator && (
                      <Selection
                        label="許可"
                        checked={approvedPubkeys.has(application.applicantPubkey)}
                        onChange={() =>
                          onToggleApproval(application.applicantPubkey)
                        }
                        pubkey={application.applicantPubkey}
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
