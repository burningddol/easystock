import { redirect } from "next/navigation";

export default function MenuForecastPage(): React.ReactElement {
  redirect("/inventory/forecast?tab=menu");
}
