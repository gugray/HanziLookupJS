using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;

namespace MmahConvert
{
    public class Compacter
    {
        private class Hanzi
        {
            public char Char;
            public int StrokeCount;
            public List<SubStroke> SubStrokes;
        }

        private List<Hanzi> data = new List<Hanzi>();

        public void Parse(string fileName)
        {
            string strAll;
            using (FileStream fs = new FileStream(fileName, FileMode.Open, FileAccess.Read))
            using (StreamReader sr = new StreamReader(fs))
            {
                strAll = sr.ReadToEnd();
            }
            JArray root = JArray.Parse(strAll);
            foreach (var jsonChar in root.Children())
            {
                data.Add(parseHanzi(jsonChar as JArray));
            }
        }

        private Hanzi parseHanzi(JArray jsonChar)
        {
            Hanzi hanzi = new Hanzi
            {
                Char = jsonChar[0].ToObject<string>()[0],
                StrokeCount = jsonChar[1].ToObject<int>(),
                SubStrokes = new List<SubStroke>(),
            };
            JArray jsonSubStrokes = jsonChar[2] as JArray;
            foreach (var x in jsonSubStrokes.Children())
            {
                JArray jsonSS = x as JArray;
                SubStroke ss = new SubStroke
                {
                    Dir = jsonSS[0].ToObject<double>(),
                    Len = jsonSS[1].ToObject<double>(),
                };
                hanzi.SubStrokes.Add(ss);
            }
            return hanzi;
        }

        public void WriteResults(string compactFileName)
        {
            Dictionary<char, int> hanziToSubStrokePos = new Dictionary<char, int>();
            List<byte> subStrokeData = new List<byte>();
            foreach (Hanzi hanzi in data)
            {
                hanziToSubStrokePos[hanzi.Char] = subStrokeData.Count;
                for (int i = 0; i != hanzi.SubStrokes.Count; ++i)
                {
                    SubStroke ss = hanzi.SubStrokes[i];
                    double x = ss.Dir * 256.0 / Math.PI / 2.0;
                    int y = (int)Math.Round(x);
                    if (y == 256) y = 0;
                    if (y < 0 || y > 255) throw new Exception("Value out of byte range.");
                    subStrokeData.Add((byte)y);
                    x = ss.Len * 255.0;
                    y = (int)Math.Round(x);
                    if (y < 0 || y > 255) throw new Exception("Value out of byte range.");
                    subStrokeData.Add((byte)y);
                    y = (int)Math.Round(ss.CenterX * 15.0);
                    if (y < 0 || y > 15) throw new Exception("Value out of byte range.");
                    byte coords = (byte)y;
                    coords <<= 4;
                    y = (int)Math.Round(ss.CenterY * 15.0);
                    if (y < 0 || y > 15) throw new Exception("Value out of byte range.");
                    coords += (byte)y;
                    subStrokeData.Add(coords);
                }
            }
            string base64 = Convert.ToBase64String(subStrokeData.ToArray());

            using (FileStream fs = new FileStream(compactFileName, FileMode.Create, FileAccess.ReadWrite))
            using (StreamWriter sw = new StreamWriter(fs))
            {
                sw.WriteLine("{ \"chars\": [");

                for (int i = 0; i != data.Count; ++i)
                {
                    Hanzi hanzi = data[i];
                    string line = "[\"" + hanzi.Char + "\"," + hanzi.StrokeCount + ",";
                    line += hanzi.SubStrokes.Count + ",";
                    line += hanziToSubStrokePos[hanzi.Char] + "]";
                    if (i + 1 < data.Count) line += ",";
                    sw.WriteLine(line);
                }
                sw.WriteLine("],");
                sw.WriteLine("\"substrokes\": \"" + base64 + "\"");
                sw.WriteLine("}");
            }
        }

    }
}

