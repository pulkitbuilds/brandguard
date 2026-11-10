"""Labelled evaluation set (synthetic, written by the team). Each draft = neutral filler sentences plus
0-3 inserted sentences with a known label. Deterministic (seeded)."""
import random

EVAL_RULES = """Terminology | utilize | use | Terminology glossary
Terminology | e-?mail | email | Terminology glossary
Terminology | click here | select this link | Style guide
Tone | gonna | going to | Brand voice guide
Tone | awesome | excellent | Brand voice guide
Tone | !{2,} | ! | Brand voice guide
Claims | no\\.?\\s?1\\b | (add proof or remove) | Claims policy
Claims | 100% guaranteed | (add proof or remove) | Claims policy
Claims | world-?class | (add proof or remove) | Claims policy
Semantic | We guarantee you will get a job | (add proof or remove) | Claims policy
Semantic | We are the best in the industry | (add proof or remove) | Claims policy
Semantic | You will definitely see results | (add proof or remove) | Claims policy"""
EVAL_FACTS = "clients: 500\nstudents: 20,000\napproved claim: Rated 4.7 out of 5 by 2,000 learners (survey, Q3 2026)"

FILLER = ["Our next batch starts in January.", "The course covers Python, statistics and project work.", "Classes run on weekday evenings.",
          "You can attend the first session for free.", "Mentors review every project.", "The campus is close to the main bus stop.",
          "Registration closes two weeks before the start date.", "We share the full syllabus on request.", "Learners work in small teams.",
          "Weekly quizzes help track progress."]
# (category, sentence) known violations the Round-2 engine CAN catch (exact patterns)
EXACT = [("Terminology", "Utilize our portal to enrol."), ("Terminology", "Please e-mail the admissions team."), ("Terminology", "Click here to apply."),
         ("Tone", "We're gonna help you grow."), ("Tone", "Our mentors are awesome."), ("Tone", "Apply now!!!"),
         ("Claims", "We are India's No.1 institute."), ("Claims", "Results are 100% guaranteed."), ("Claims", "A world-class faculty teaches you."),
         ("Facts", "Join our 100 clients today."), ("Facts", "Over 300 clients trust us.")]
# violations stated in other words: only a meaning-based check can catch these
REPHRASED = [("Claims", "We promise every learner a placement."), ("Claims", "Placement is assured for all our students."),
             ("Claims", "A job is certain once you finish the course."), ("Claims", "Every graduate is definitely hired."),
             ("Claims", "We are unrivalled in the industry."), ("Claims", "Ours is the finest programme around."),
             ("Claims", "You are certain to see results."), ("Claims", "Success is assured when you join us."),
             ("Claims", "Every student is guaranteed employment."), ("Claims", "We are the leading name in the industry."),
             ("Claims", "Nobody beats us in this field."), ("Claims", "Land your dream career with our promise of work."),
             ("Facts", "We now serve 120 customers."), ("Facts", "Trusted by 250 customers worldwide."),
             ("Facts", "Our community has 5,000 learners.")]
# fine to publish, but close to the above
BENIGN = ["We do not guarantee placement.", "Read our guarantee policy on the terms page.", "Our placement team helps learners prepare for interviews.",
          "The best time to enrol is early January.", "We never promise results, only support.", "Our 500 clients include schools and startups.",
          "Rated 4.7 out of 5 by 2,000 learners (survey, Q3 2026).", "Each learner receives career advice.", "Employers visit the campus twice a year.",
          "We cannot ensure a job, but we help you apply."]


def build(n=110, seed=7):
    rnd, data = random.Random(seed), []
    pools = [("exact", EXACT), ("rephrased", REPHRASED), ("benign", None), ("clean", None)]
    for k in range(n):
        kind = pools[k % 4][0]
        parts = rnd.sample(FILLER, rnd.randint(2, 4))
        labels = []
        ins = []
        if kind == "exact": ins = rnd.sample(EXACT, rnd.randint(1, 2))
        elif kind == "rephrased": ins = rnd.sample(REPHRASED, rnd.randint(1, 2))
        elif kind == "benign": ins = [("ok", s) for s in rnd.sample(BENIGN, rnd.randint(1, 2))]
        for cat, s in ins:
            parts.insert(rnd.randint(0, len(parts)), s)
        text = " ".join(parts)
        for cat, s in ins:
            if cat != "ok":
                labels.append({"cat": cat, "start": text.index(s), "end": text.index(s) + len(s), "kind": kind})
        data.append({"id": k, "kind": kind, "text": text, "labels": labels})
    return data
