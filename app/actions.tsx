"use server";

import { kv } from "@vercel/kv";
import { revalidatePath } from "next/cache";
import {Poll, POLL_EXPIRY} from "./types";
import {redirect} from "next/navigation";
import  Database  from "@replit/database";
const db = new Database();

export async function savePoll(poll: Poll, formData: FormData) {
  let newPoll = {
    ...poll,
    created_at: Date.now(),
    title: formData.get("title") as string,
    option1: formData.get("option1") as string,
    option2: formData.get("option2") as string,
    option3: formData.get("option3") as string,
    option4: formData.get("option4") as string,
    votes: [0, 0, 0, 0] // Assuming a structure for storing votes
  };
  // Save the new poll object, ReplDB does not support hash sets like Vercel KV, so we store the whole object
  await db.set(`poll:${newPoll.id}`, JSON.stringify(newPoll));

  // No direct expire equivalent in ReplDB, consider cleanup logic or external expiry handling if needed

  // In ReplDB, instead of sorted sets, just update a list of poll IDs by date if necessary
  // This part will be omitted here due to complexity and lack of direct support

  revalidatePath("/polls");
  redirect(`/polls/${newPoll.id}`);
}

export async function votePoll(poll: Poll, optionIndex: number) {
  const pollData = await db.get(`poll:${poll.id}`);
  if (!pollData) return;
  const existingPoll = JSON.parse(pollData as string);
  existingPoll.votes[optionIndex]++;
  await db.set(`poll:${poll.id}`, JSON.stringify(existingPoll));

  revalidatePath(`/polls/${poll.id}`);
  redirect(`/polls/${poll.id}`);
}
export async function redirectToPolls() {
  redirect("/polls");
}