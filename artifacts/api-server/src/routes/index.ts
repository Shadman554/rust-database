import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import dictionaryRouter from "./dictionary.js";
import diseasesRouter from "./diseases.js";
import drugsRouter from "./drugs.js";
import booksRouter from "./books.js";
import instrumentsRouter from "./instruments.js";
import testsRouter from "./tests.js";
import slidesRouter from "./slides.js";
import notesRouter from "./notes.js";
import normalRangesRouter from "./normalRanges.js";
import aboutRouter from "./about.js";
import searchRouter from "./search.js";
import uploadRouter from "./upload.js";
import notificationsRouter from "./notifications.js";
import docsRouter from "./docs.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dictionaryRouter);
router.use(diseasesRouter);
router.use(drugsRouter);
router.use(booksRouter);
router.use(instrumentsRouter);
router.use(testsRouter);
router.use(slidesRouter);
router.use(notesRouter);
router.use(normalRangesRouter);
router.use(aboutRouter);
router.use(searchRouter);
router.use(uploadRouter);
router.use(notificationsRouter);
router.use(docsRouter);

export default router;
