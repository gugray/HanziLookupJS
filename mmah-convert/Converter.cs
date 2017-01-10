using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;

namespace MmahConvert
{
    public class Converter
    {
        private struct Point
        {
            public int X;
            public int Y;
        }

        private class SubStroke
        {
            double Dir;
            double Len;
            double CenterX;
            double CenterY;
        }

        private class Stroke
        {
            public List<Point> Points = new List<Point>();
            public Point Center;
            public List<SubStroke> SubStrokes = new List<SubStroke>();
        }

        private class Hanzi
        {
            public char Char;
            public List<Stroke> Strokes = new List<Stroke>();
        }

        private List<Hanzi> data = new List<Hanzi>();

        /// <summary>
        /// Parses MMAH graphics.txt and analyzes characters; keeps all data in memory.
        /// </summary>
        /// <param name="mmahGraphicsFileName"></param>
        public void Parse(string mmahGraphicsFileName)
        {
            using (FileStream fs = new FileStream(mmahGraphicsFileName, FileMode.Open, FileAccess.Read))
            using (StreamReader sr = new StreamReader(fs))
            {
                string line;
                while ((line = sr.ReadLine()) != null)
                {
                    Hanzi hanzi = parseCharacter(line);
                    normalize(hanzi);
                    data.Add(hanzi);
                }
            }
        }

        private Hanzi parseCharacter(string line)
        {
            Hanzi hanzi = new Hanzi();
            JObject o = JObject.Parse(line);
            string strChar = (string)o["character"];
            if (strChar.Length != 1) throw new Exception("Not a character: " + strChar);
            hanzi.Char = strChar[0];
            var strokes = (JArray)o["medians"];
            foreach (var jsonStroke in strokes.Children())
            {
                Stroke stroke = new Stroke();
                foreach (var jsonPoint in jsonStroke.Children())
                {
                    Point point = new Point
                    {
                        X = (int)jsonPoint[0],
                        Y = (int)jsonPoint[1],
                    };
                    stroke.Points.Add(point);
                }
                hanzi.Strokes.Add(stroke);
            }
            return hanzi;
        }

        /// <summary>
        /// Converts coordinates to sane top-down system; 250x250 canvas.
        /// Calculates substrokes with normalized values.
        /// </summary>
        private static void normalize(Hanzi hanzi)
        {
            double ratio = 250.0 / 1024.0;
            foreach (var stroke in hanzi.Strokes)
            {
                for (int i = 0; i != stroke.Points.Count; ++i)
                {
                    Point pt = stroke.Points[i];
                    double x = pt.X;
                    double y = pt.Y;
                    y = 900 - y;
                    x *= ratio;
                    y *= ratio;
                    x = Math.Round(x);
                    y = Math.Round(y);
                    stroke.Points[i] = new Point { X = (int)x, Y = (int)y };
                }
            }
        }

        /// <summary>
        /// Writes result as JS data files for use in HanziLookupJS library.
        /// </summary>
        /// <param name="mediansFileName">Un-analyzed visual strokes from medians.</param>
        /// <param name="strokesFileName">Analyzed substrokes for character recognition.</param>
        public void WriteResults(string mediansFileName, string strokesFileName)
        {
            using (FileStream fs = new FileStream("x-mmah-medians.js", FileMode.Create, FileAccess.ReadWrite))
            using (StreamWriter sw = new StreamWriter(fs))
            {
                sw.WriteLine("\"use strict\";");
                sw.WriteLine("var HL = HL || { };");
                sw.WriteLine("HL.StrokeDataHL = [");

                foreach (Hanzi hanzi in data)
                {
                    string line = "[\"" + hanzi.Char + "\",[";

                    for (int i = 0; i != hanzi.Strokes.Count; ++i)
                    {
                        Stroke stroke = hanzi.Strokes[i];
                        if (i != 0) line += ",";
                        // Each stroke is an array itself
                        line += "[";
                        for (int j = 0; j != stroke.Points.Count; ++j)
                        {
                            Point pt = stroke.Points[j];
                            // Each point is an array of two items
                            if (j != 0) line += ",";
                            line += "[" + pt.X + "," + pt.Y + "]";
                        }
                        line += "]";
                    }

                    line += "]],";
                    sw.WriteLine(line);
                }

                sw.WriteLine("];");
            }
        }
    }
}
