<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImprovementAction extends Model
{
    protected $table = 'improvement_actions';

    protected $fillable = [
        'recommendation_id',
        'department_id',
        'pic_employee_id',
        'title',
        'action_plan',
        'due_date',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date:Y-m-d',
        ];
    }

    public function recommendation(): BelongsTo
    {
        return $this->belongsTo(Recommendation::class, 'recommendation_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function picEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'pic_employee_id');
    }

    public function updates(): HasMany
    {
        return $this->hasMany(ActionUpdate::class, 'improvement_action_id');
    }
}
