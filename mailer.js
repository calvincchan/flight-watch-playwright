import { createClient } from "@supabase/supabase-js";
import { sendEmailWithMailgun } from "./mailgun.js";

export async function mailer() {
  /** Prepare Supabase */
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  /** Check all watches */
  const { data: watches, error } = await supabase
    .from("watch")
    .select("*")
    .eq("is_enabled", true)
    .gte("watch_date", new Date().toISOString());
  if (error) {
    console.error("Failed to fetch watches", error);
    return;
  }
  for (const watch of watches) {
    /** Check the latest price */
    const watchDate = watch.watch_date;
    const { data: day_record, error } = await supabase
      .from("day_record")
      .select("*")
      .eq("content_date", watchDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error) {
      console.error("Failed to fetch day record", error);
      return;
    }
    /** if the latest price is different from the watch record, the send notification and email user. */
    const lastPrice = watch.last_price;
    const newPrice = day_record.price;
    if (lastPrice !== newPrice) {
      console.log("price changed!");
      /** Send notification */
      const {
        data: { user },
        error,
      } = await supabase.auth.admin.getUserById(watch.user);
      if (error) {
        console.error("Failed to fetch user", error);
        return;
      }
      await sendEmail(
        user.email,
        watchDate,
        lastPrice,
        newPrice,
        day_record.raw_text
      );
      /** Update timestamp */
      await supabase
        .from("watch")
        .update({
          last_price: day_record.price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", watch.id);
    } else {
      await supabase
        .from("watch")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", watch.id);
    }
  }
}

async function sendEmail(to, watchDate, lastPrice, newPrice, rawText) {
  const subject = `Price change alert for ${watchDate}`;
  const lines = [
    `Price changed detected for ${watchDate} from ${lastPrice ?? "N/A"} to ${
      newPrice ?? "N/A"
    }`,
    ``,
    `Original message: ${rawText}`,
    ``,
    `This is an automated message, do not reply.`,
  ];
  const emailResult = await sendEmailWithMailgun(to, subject, lines.join("\n"));
  console.log("Email sent", emailResult);
}
