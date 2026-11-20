<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\EmploymentTypeController;
use App\Http\Controllers\Api\V1\MasterLookupController;
use App\Http\Controllers\Api\V1\SurveyController;
use App\Http\Controllers\Api\V1\TaskAssignmentController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\TrainingController;
use App\Http\Controllers\Api\V1\TrainingParticipationController;
use App\Http\Controllers\Api\V1\WorkplaceIssueController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Auth routes
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::delete('/auth/logout', [AuthController::class, 'logout']);

        // Read access for Admin & Manager
        Route::middleware('role:admin,manager')->group(function () {
            Route::get('/employees', [EmployeeController::class, 'index']);
            Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
            Route::get('/employment-types', [EmploymentTypeController::class, 'index']);
            Route::get('/employment-types/{employmentType}', [EmploymentTypeController::class, 'show']);
            Route::get('/departments', [DepartmentController::class, 'index']);
            Route::get('/departments/{department}', [DepartmentController::class, 'show']);
            Route::get('/positions', [MasterLookupController::class, 'positions']);
        });

        // Write access strictly for Admin (PBI-01: FR-02 & FR-05, PBI-02: FR-03)
        Route::middleware('role:admin')->group(function () {
            Route::post('/employees', [EmployeeController::class, 'store']);
            Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
            Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);

            Route::post('/employment-types', [EmploymentTypeController::class, 'store']);
            Route::put('/employment-types/{employmentType}', [EmploymentTypeController::class, 'update']);
            Route::delete('/employment-types/{employmentType}', [EmploymentTypeController::class, 'destroy']);

            Route::post('/departments', [DepartmentController::class, 'store']);
            Route::put('/departments/{department}', [DepartmentController::class, 'update']);
            Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
        });

        // Read access for Admin, Manager, & Employee (PBI-03: FR-06, PBI-04: FR-07, PBI-06: FR-15)
        Route::middleware('role:admin,manager,employee')->group(function () {
            Route::get('/tasks', [TaskController::class, 'index']);
            Route::get('/tasks/{task}', [TaskController::class, 'show']);

            Route::get('/task-assignments', [TaskAssignmentController::class, 'index']);
            Route::get('/task-assignments/{taskAssignment}', [TaskAssignmentController::class, 'show']);

            Route::get('/training-participations', [TrainingParticipationController::class, 'index']);
            Route::get('/training-participations/{trainingParticipation}', [TrainingParticipationController::class, 'show']);
        });

        // Write access for Admin & Manager (PBI-03: FR-06, PBI-04: FR-07, PBI-05 & PBI-06: FR-15)
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/tasks', [TaskController::class, 'store']);
            Route::put('/tasks/{task}', [TaskController::class, 'update']);
            Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);

            Route::post('/task-assignments', [TaskAssignmentController::class, 'store']);
            Route::put('/task-assignments/{taskAssignment}', [TaskAssignmentController::class, 'update']);
            Route::delete('/task-assignments/{taskAssignment}', [TaskAssignmentController::class, 'destroy']);

            Route::get('/trainings', [TrainingController::class, 'index']);
            Route::get('/trainings/{training}', [TrainingController::class, 'show']);
            Route::post('/trainings', [TrainingController::class, 'store']);
            Route::put('/trainings/{training}', [TrainingController::class, 'update']);
            Route::delete('/trainings/{training}', [TrainingController::class, 'destroy']);

            Route::post('/training-participations', [TrainingParticipationController::class, 'store']);
            Route::put('/training-participations/{trainingParticipation}', [TrainingParticipationController::class, 'update']);
            Route::delete('/training-participations/{trainingParticipation}', [TrainingParticipationController::class, 'destroy']);
        });

        // Work Surveys & NFR-02 Department Aggregation Privacy (PBI-07: FR-12)
        Route::middleware('survey.privacy')->group(function () {
            Route::middleware('role:admin,manager,employee')->group(function () {
                Route::get('/surveys', [SurveyController::class, 'index']);
                Route::get('/surveys/{survey}', [SurveyController::class, 'show']);
                Route::post('/surveys/{survey}/responses', [SurveyController::class, 'submitResponse']);
                Route::put('/surveys/{survey}/responses', [SurveyController::class, 'updateResponse']);
            });

            Route::middleware('role:admin,manager')->group(function () {
                Route::post('/surveys', [SurveyController::class, 'store']);
                Route::put('/surveys/{survey}', [SurveyController::class, 'update']);
                Route::delete('/surveys/{survey}', [SurveyController::class, 'destroy']);
            });
        });

        // Workplace Issues Reporting & Resolution (PBI-08: FR-13)
        Route::middleware('role:admin,manager,employee')->group(function () {
            Route::get('/workplace-issues', [WorkplaceIssueController::class, 'index']);
            Route::post('/workplace-issues', [WorkplaceIssueController::class, 'store']);
            Route::get('/workplace-issues/{workplaceIssue}', [WorkplaceIssueController::class, 'show']);
            Route::put('/workplace-issues/{workplaceIssue}', [WorkplaceIssueController::class, 'update']);
            Route::delete('/workplace-issues/{workplaceIssue}', [WorkplaceIssueController::class, 'destroy']);
        });
    });
});
