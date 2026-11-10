"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listenForForegroundMessages, requestAndRegisterPushToken } from "../lib/firebase/messaging";

type AttendanceRole = "user" | "admin";
type AttendanceStatus = "attending" | "not_attending";

interface AttendanceEvent {
  id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  province: string;
}

interface Participant {
  attendance_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  attendance_status: AttendanceStatus;
  event_dates: string[];
}

interface AttendancePayload {
  event_id: string;
  total_responses: number;
  attending: number;
  not_attending: number;
  participants: Participant[];
}

interface EventAttendanceProps {
  event: AttendanceEvent;
  role: AttendanceRole;
  onOpenProfile: (userId: string) => void;
}

function dateRange(start: string, end: string) {
  const result: string[] = [];
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start || "");
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end || "");
  if (!startMatch || !endMatch) return result;

  const cursor = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3])));
  const last = new Date(Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])));
  if (last < cursor) return result;

  while (cursor <= last && result.length < 366) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    .toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function EventAttendance({ event, role, onOpenProfile }: EventAttendanceProps) {
  const [attendance, setAttendance] = useState<AttendancePayload | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>("attending");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (notificationPermission !== "granted") return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void listenForForegroundMessages(({ title, body }) => {
      setNotificationMessage(`${title}: ${body}`);
    }).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    }).catch((foregroundError) => {
      console.error("FCM foreground listener failed:", foregroundError);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [notificationPermission]);

  const activateNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setNotificationMessage("");
    try {
      const token = await requestAndRegisterPushToken();
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          platform: "web",
          deviceLabel: navigator.userAgent.slice(0, 100),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menghubungkan perangkat dengan NGIPEN.");
      }

      setNotificationPermission("granted");
      setNotificationMessage("Notifikasi berhasil diaktifkan pada perangkat ini.");
      setNotificationPromptOpen(false);
    } catch (activationError) {
      setNotificationMessage(
        activationError instanceof Error
          ? activationError.message
          : "Gagal mengaktifkan notifikasi."
      );
      if ("Notification" in window) setNotificationPermission(Notification.permission);
    } finally {
      setNotificationBusy(false);
    }
  };

  const sendTestNotification = async () => {
    setNotificationBusy(true);
    setNotificationMessage("");
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Notifikasi percobaan gagal dikirim.");
      }
      setNotificationMessage(
        `Notifikasi percobaan dikirim ke ${result.sent} perangkat; gagal ${result.failed}.`
      );
    } catch (testError) {
      setNotificationMessage(testError instanceof Error ? testError.message : "Notifikasi percobaan gagal.");
    } finally {
      setNotificationBusy(false);
    }
  };

  const availableDates = useMemo(
    () => dateRange(event.start_date, event.end_date),
    [event.start_date, event.end_date]
  );

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/event-attendance?eventId=${encodeURIComponent(event.id)}`,
        { method: "GET", credentials: "include", cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal memuat daftar kehadiran.");
      }

      setAttendance(result.attendance || null);
      setPollOpen(Boolean(result.pollOpen));

      if (result.ownAttendance) {
        setSelectedStatus(result.ownAttendance.attendance_status);
        setSelectedDates(result.ownAttendance.event_dates || []);
      } else {
        setSelectedStatus("attending");
        setSelectedDates([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat daftar kehadiran.");
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const toggleDate = (date: string) => {
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((item) => item !== date)
        : [...current, date].sort()
    );
  };

  const submitAttendance = async () => {
    if (role !== "user" || !pollOpen || saving) return;
    if (selectedStatus === "attending" && selectedDates.length === 0) {
      setError("Pilih minimal satu tanggal kehadiran.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/event-attendance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          attendanceStatus: selectedStatus,
          eventDates: selectedStatus === "attending" ? selectedDates : [],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menyimpan pilihan kehadiran.");
      }

      setNotice("Pilihan kehadiran berhasil disimpan.");
      await loadAttendance();
      if (selectedStatus === "attending" && notificationPermission !== "granted") {
        setNotificationPromptOpen(true);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan pilihan kehadiran.");
    } finally {
      setSaving(false);
    }
  };

  const participants = attendance?.participants || [];

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5" aria-labelledby="event-attendance-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="event-attendance-title" className="text-lg font-black">Konfirmasi Kehadiran</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Lihat siapa yang akan hadir di event ini.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAttendance()}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold hover:border-red-500 disabled:opacity-50 dark:border-gray-700"
        >
          Muat ulang
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Memuat daftar kehadiran…</p>
      ) : error && !attendance ? (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xl font-black">{attendance?.total_responses || 0}</p>
              <p className="text-[11px] text-gray-500">Merespons</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3 dark:bg-green-950/30">
              <p className="text-xl font-black text-green-700 dark:text-green-300">{attendance?.attending || 0}</p>
              <p className="text-[11px] text-green-700 dark:text-green-300">Hadir</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
              <p className="text-xl font-black text-red-700 dark:text-red-300">{attendance?.not_attending || 0}</p>
              <p className="text-[11px] text-red-700 dark:text-red-300">Tidak hadir</p>
            </div>
          </div>

          {role === "user" && (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-3 dark:border-gray-700">
              <p className="text-sm font-bold">Apakah kamu akan hadir?</p>
              {!pollOpen ? (
                <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Polling ditutup saat event dimulai.
                </p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStatus("attending")}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${selectedStatus === "attending" ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "border-gray-200 dark:border-gray-700"}`}
                      aria-pressed={selectedStatus === "attending"}
                    >
                      Hadir
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus("not_attending")}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${selectedStatus === "not_attending" ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border-gray-200 dark:border-gray-700"}`}
                      aria-pressed={selectedStatus === "not_attending"}
                    >
                      Tidak Hadir
                    </button>
                  </div>

                  {selectedStatus === "attending" && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Pilih tanggal kehadiran (bisa lebih dari satu):
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {availableDates.map((date) => (
                          <label key={date} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedDates.includes(date)}
                              onChange={() => toggleDate(date)}
                              className="h-4 w-4 accent-red-600"
                            />
                            <span>{formatDate(date)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void submitAttendance()}
                    disabled={saving || (selectedStatus === "attending" && selectedDates.length === 0)}
                    className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Menyimpan…" : "Simpan Kehadiran"}
                  </button>
                </>
              )}
            </div>
          )}

          {role === "user" && (
            <div className="mt-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">Notifikasi NGIPEN</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {notificationPermission === "granted"
                      ? "Izin notifikasi browser sudah diberikan. Hubungkan perangkat ini untuk menerima pengingat event."
                      : notificationPermission === "denied"
                        ? "Izin notifikasi diblokir. Ubah izin NGIPEN melalui pengaturan browser."
                        : "Aktifkan notifikasi agar tidak melewatkan pengingat event yang kamu pilih Hadir."}
                  </p>
                </div>
                {notificationPermission !== "denied" && (
                  <button
                    type="button"
                    onClick={() => void activateNotifications()}
                    disabled={notificationBusy}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {notificationBusy ? "Memproses…" : notificationPermission === "granted" ? "Hubungkan Perangkat" : "Aktifkan Notifikasi"}
                  </button>
                )}
                {notificationPermission === "granted" && (
                  <button
                    type="button"
                    onClick={() => void sendTestNotification()}
                    disabled={notificationBusy}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-600 disabled:opacity-50"
                  >
                    Tes Notifikasi
                  </button>
                )}
              </div>
              {notificationMessage && (
                <p role="status" className="mt-3 text-xs text-gray-600 dark:text-gray-300">{notificationMessage}</p>
              )}
            </div>
          )}

          {role === "admin" && (
            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Mode admin: hanya dapat melihat daftar kehadiran. Pengiriman absensi dilakukan oleh pengguna melalui akun masing-masing.
            </p>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-black">Daftar peserta ({participants.length})</h3>
            {participants.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-gray-700">
                Belum ada pengguna yang mengisi konfirmasi kehadiran.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {participants.map((participant) => (
                  <li key={participant.attendance_id} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(participant.user_id)}
                      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={`Lihat profil ${participant.display_name || "Pengguna"}`}
                    >
                      {participant.avatar_url ? (
                        <img
                          src={participant.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-sm font-black text-red-700 dark:bg-red-950 dark:text-red-300">
                          {(participant.display_name || "P")[0].toUpperCase()}
                        </span>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(participant.user_id)}
                          className="text-left text-sm font-bold hover:text-red-600 hover:underline"
                        >
                          {participant.display_name || "Pengguna NGIPEN"}
                        </button>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${participant.attendance_status === "attending" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                          {participant.attendance_status === "attending" ? "Hadir" : "Tidak Hadir"}
                        </span>
                      </div>
                      {participant.attendance_status === "attending" && participant.event_dates.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {participant.event_dates.map(formatDate).join(" • ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {notificationPromptOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="notification-prompt-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900">
            <div className="text-3xl" aria-hidden="true">🔔</div>
            <h3 id="notification-prompt-title" className="mt-2 text-lg font-black">Aktifkan Pengingat Event?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Kamu berhasil memilih Hadir. Aktifkan notifikasi agar NGIPEN dapat mengingatkanmu sebelum event dimulai dan pada hari event.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNotificationPromptOpen(false)}
                className="rounded-xl border border-gray-300 px-3 py-3 text-sm font-bold dark:border-gray-700"
              >
                Nanti Saja
              </button>
              <button
                type="button"
                onClick={() => void activateNotifications()}
                disabled={notificationBusy}
                className="rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {notificationBusy ? "Memproses…" : "Aktifkan Notifikasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && attendance && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}
      {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">{notice}</p>}
    </section>
  );
}
