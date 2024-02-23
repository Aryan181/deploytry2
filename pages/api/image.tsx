// Import necessary libraries and types
import Database from "@replit/database";
import type { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import satori from "satori";
import { join } from 'path';
import * as fs from "fs";

// Instantiate ReplDB client
const db = new Database();

// Path and data for custom font
const fontPath = join(process.cwd(), 'Roboto-Regular.ttf');
let fontData = fs.readFileSync(fontPath);

// API handler function
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const pollId = req.query['id'];
        if (!pollId) {
            return res.status(400).send('Missing poll ID');
        }

        // Retrieve the poll data from ReplDB and parse it from JSON
        let pollString = await db.get(`poll:${pollId}`);
        let poll = pollString ? JSON.parse(pollString) : null;

        if (!poll) {
            return res.status(404).send('Poll not found');
        }

        const showResults = req.query['results'] === 'true';
        const pollOptions = [poll.option1, poll.option2, poll.option3, poll.option4]
            .filter(option => option !== '');
        const totalVotes = pollOptions
            .map((option, index) => parseInt(poll[`votes${index + 1}`]))
            .reduce((a, b) => a + b, 0);
        const pollData = {
            question: showResults ? `Results for ${poll.title}` : poll.title,
            options: pollOptions.map((option, index) => {
                const votes = poll[`votes${index + 1}`];
                const percentOfTotal = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                let text = showResults ? `${percentOfTotal}%: ${option} (${votes} votes)` : `${index + 1}. ${option}`;
                return { option, votes, text, percentOfTotal };
            })
        };

        // Generate SVG using satori with your design and data
        const svg = await satori(
            <div style={{
                justifyContent: 'flex-start',
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#f4f4f4',
                padding: '50px',
                lineHeight: '1.2',
                fontSize: '24px',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px',
                }}>
                    <h2 style={{ textAlign: 'center', color: 'lightgray' }}>{poll.title}</h2>
                    {pollData.options.map((opt, index) => (
                        <div key={index} style={{
                            backgroundColor: showResults ? '#007bff' : 'transparent',
                            color: '#fff',
                            padding: '10px',
                            marginBottom: '10px',
                            borderRadius: '4px',
                            width: `${showResults ? opt.percentOfTotal : 100}%`,
                            whiteSpace: 'nowrap',
                            overflow: 'visible',
                        }}>
                            {opt.text}
                        </div>
                    ))}
                </div>
            </div>,
            {
                width: 600, height: 400, fonts: [{
                    data: fontData,
                    name: 'Roboto',
                    style: 'normal',
                    weight: '400'
                }]
            }
        );

        // Convert SVG to PNG using Sharp
        const pngBuffer = await sharp(Buffer.from(svg))
            .toFormat('png')
            .toBuffer();

        // Set the content type to PNG and send the response
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'max-age=10');
        res.send(pngBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating image');
    }
}
