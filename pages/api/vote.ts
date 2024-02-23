import type { NextApiRequest, NextApiResponse } from 'next';
import { Database } from '@replit/database';
import { Poll, POLL_EXPIRY } from "@/app/types";

const db = new Database();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const pollId = req.query['id']
            const results = req.query['results'] === 'true'
            let voted = req.query['voted'] === 'true'
            if (!pollId) {
                return res.status(400).send('Missing poll ID');
            }

            let pollData = await db.get(`poll:${pollId}`);
            let poll: Poll | null = pollData ? JSON.parse(pollData) : null;
            if (!poll) {
                return res.status(400).send('Poll not found');
            }

            const optionIndex = parseInt(req.body.optionIndex);
            if (isNaN(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
                return res.status(400).send('Invalid option index');
            }

            const voteExists = poll.voted.includes(req.body.fid);
            voted = voted || voteExists;

            if (!voted) {
                poll.votes[optionIndex] = (poll.votes[optionIndex] || 0) + 1;
                poll.voted.push(req.body.fid);
                await db.set(`poll:${pollId}`, JSON.stringify(poll));
            }

            const imageUrl = `${process.env['HOST']}/api/image?id=${pollId}&results=${results ? 'false' : 'true'}&date=${Date.now()}`;
            let button1Text = results || voted ? "View Results" : "Vote Again";

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
                    <meta name="fc:frame:post_url" content="${process.env['HOST']}/api/vote?id=${pollId}&voted=true&results=${results ? 'false' : 'true'}">
                    <meta name="fc:frame:button:1" content="${button1Text}">
                    <meta name="fc:frame:button:2" content="Create your poll">
                    <meta name="fc:frame:button:2:action" content="post_redirect">
                </head>
                <body>
                    <p>${results || voted ? `You have already voted. You clicked option ${optionIndex}.` : `Your vote for option ${optionIndex} has been recorded.`}</p>
                </body>
                </html>
            `);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error processing request');
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
