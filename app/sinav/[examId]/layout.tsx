/**
 * Sinav cozme duzeni.
 *
 * `/dashboard` altinda DEGIL: panel kabugu (sol menu, ust cubuk, kitap
 * raflari) sinav sirasinda hem dikkat dagitiyor hem de ekrandan yer
 * caliyordu. Ogrenci sureyle yarisirken gorunmesi gereken tek sey soru.
 *
 * Bu yuzden sinav kendi kok duzenine sahip: hicbir gezinti ogesi yok,
 * cikis yalnizca "Sinavi bitir" ya da tarayici geri tusuyla.
 */
export default function SinavLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-screen flex-col bg-background">{children}</div>;
}
