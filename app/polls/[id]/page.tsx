import  Database  from "@replit/database";
const db = new Database();
import { Poll } from "@/app/types";
import { PollVoteForm } from "@/app/form";
import Head from "next/head";
import { Metadata, ResolvingMetadata } from "next";

async function getPoll(id: string): Promise<Poll> {
    let nullPoll = {
        id: "",
        title: "No poll found",
        option1: "",
        option2: "",
        option3: "",
        option4: "",
        votes1: 0, // Adjusted to individual vote properties
        votes2: 0,
        votes3: 0,
        votes4: 0,
        created_at: 0,
    };

    try {
        const pollData = await db.get(`poll:${id}`);
        if (!pollData) {
            return nullPoll;
        }
        const parsedData = JSON.parse(pollData as string);
        const poll: Poll = {
            id: parsedData.id,
            title: parsedData.title,
            option1: parsedData.option1,
            option2: parsedData.option2,
            option3: parsedData.option3,
            option4: parsedData.option4,
            votes1: parsedData.votes[0], // Correctly mapping votes to individual properties
            votes2: parsedData.votes[1],
            votes3: parsedData.votes[2],
            votes4: parsedData.votes[3],
            created_at: parsedData.created_at,
        };

        return poll;
    } catch (error) {
        console.error(error);
        return nullPoll;
    }
}
type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
    { params, searchParams }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    // read route params
    const id = params.id
    const poll = await getPoll(id)

    const fcMetadata: Record<string, string> = {
        "fc:frame": "vNext",
        "fc:frame:post_url": `${process.env['HOST']}/api/vote?id=${id}`,
        "fc:frame:image": `${process.env['HOST']}/api/image?id=${id}`,
    };
    [poll.option1, poll.option2, poll.option3, poll.option4].filter(o => o !== "").map((option, index) => {
        fcMetadata[`fc:frame:button:${index + 1}`] = option;
    })


    return {
        title: poll.title,
        openGraph: {
            title: poll.title,
            images: [`/api/image?id=${id}`],
        },
        other: {
            ...fcMetadata,
        },
        metadataBase: new URL(process.env['HOST'] || '')
    }
}
function getMeta(
    poll: Poll
) {
    // This didn't work for some reason
    return (
        <Head>
            <meta property="og:image" content="" key="test"></meta>
            <meta property="og:title" content="My page title" key="title"/>
        </Head>
    );
}


export default async function Page({params}: { params: {id: string}}) {
    const poll = await getPoll(params.id);

    return(
        <>
            <div className="flex flex-col items-center justify-center min-h-screen py-2">
                <main className="flex flex-col items-center justify-center flex-1 px-4 sm:px-20 text-center">
                    <PollVoteForm poll={poll}/>
                </main>
            </div>
        </>
    );

}