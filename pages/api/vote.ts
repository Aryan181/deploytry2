import Database from "@replit/database";
import type { NextApiRequest, NextApiResponse } from 'next';
import { Poll, POLL_EXPIRY } from "@/app/types";
import { getSSLHubRpcClient, Message } from "@farcaster/hub-nodejs";

const HUB_URL = process.env['HUB_URL'];
const client = HUB_URL ? getSSLHubRpcClient(HUB_URL) : undefined;
const db = new Database();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const pollId = req.query['id'];
            const results = req.query['results'] === 'true';
            let voted = req.query['voted'] === 'true';
            if (!pollId) {
                return res.status(400).send('Missing poll ID');
            }

            let validatedMessage: Message | undefined = undefined;
            try {
                const frameMessage = Message.decode(Buffer.from(req.body?.trustedData?.messageBytes || '', 'hex'));
                const result = await client?.validateMessage(frameMessage);
                if (result && result.isOk() && result.value.valid) {
                    validatedMessage = result.value.message;
                }
                let urlBuffer = validatedMessage?.data?.frameActionBody?.url || [];
                const urlString = Buffer.from(urlBuffer).toString('utf-8');
                if (validatedMessage && !urlString.startsWith(process.env['HOST'] || '')) {
                    return res.status(400).send(`Invalid frame url: ${urlBuffer}`);
                }
            } catch (e) {
                return res.status(400).send(`Failed to validate message: ${e}`);
            }

            let buttonId = 0, fid = 0;
            if (client) {
                buttonId = validatedMessage?.data?.frameActionBody?.buttonIndex || 0;
                fid = validatedMessage?.data?.fid || 0;
            } else {
                buttonId = req.body?.untrustedData?.buttonIndex || 0;
                fid = req.body?.untrustedData?.fid || 0;
            }

            if ((results || voted) && buttonId === 2) {
                return res.status(302).setHeader('Location', `${process.env['HOST']}`).send('Redirecting to create poll');
            }
            const voteExistsRaw = await db.get(`poll:${pollId}:voted:${fid}`);
            const voteExists = typeof voteExistsRaw === 'string' ? voteExistsRaw === 'true' : false;
            voted = voted || voteExists;
            if (fid > 0 && buttonId > 0 && buttonId < 5 && !results && !voted) {
                const currentVotesRaw = await db.get(`poll:${pollId}:votes${buttonId}`);
                const voteCount = typeof currentVotesRaw === 'string' ? parseInt(currentVotesRaw) : 0;
                await db.set(`poll:${pollId}:votes${buttonId}`, (voteCount + 1).toString());
                await db.set(`poll:${pollId}:voted:${fid}`, 'true');
                // ReplDB does not support expire natively
            }
            let pollRaw: unknown = await db.get(`poll:${pollId}`);
            let poll: Poll | null = pollRaw as Poll | null;
            if (!poll) {
                return res.status(400).send('Missing poll ID');
            }
            const imageUrl = `${process.env['HOST']}/api/image?id=${poll.id}&results=${results ? 'false' : 'true'}&date=${Date.now()}${fid > 0 ? `&fid=${fid}` : ''}`;
            let button1Text = "View Results";
            if (!voted && !results) {
                button1Text = "Back";
            } else if (voted && !results) {
                button1Text = "Already Voted";
            } else if (voted && results) {
                button1Text = "View Results";
            }

            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(`
<!DOCTYPE html>
<html>
    <head>
        <title>Vote Recorded</title>
        <meta property="og:title" content="Vote Recorded">
        <meta property="og:image" content="${imageUrl}">
        <meta name="fc:frame" content="vNext">
        <meta name="fc:frame:image" content="${imageUrl}">
        <meta name="fc:frame:post_url" content="${process.env['HOST']}/api/vote?id=${poll.id}&voted=true&results=${results ? 'false' : 'true'}">
        <meta name="fc:frame:button:1" content="${button1Text}">
        <meta name="fc:frame:button:2" content="Create your poll">
        <meta name="fc:frame:button:2:action" content="post_redirect">
    </head>
    <body>
        <p>${results || voted ? `You have already voted. You clicked ${buttonId}` : `Your vote for ${buttonId} has been recorded for fid ${fid}.`}</p>
    </body>
</html>
`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error generating image');
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
